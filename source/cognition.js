var BIASES = function(){

/* Polyfills and utilities */
var selectAndCopyText = function( element )
{
    var range = document.createRange();
    range.selectNode(element);
    window.getSelection().addRange(range);

    try {
        // Now that we've selected the anchor text, execute the copy command
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copy email command was ' + msg);
    } catch(err) {
        console.log('Unable to copy, probably not supported!');
    }

    // Remove the selections - NOTE: Should use removeRange(range) when it is supported
    window.getSelection().removeAllRanges();
};

/*

node.data - the associated data, as specified to the constructor
node.depth - zero for the root node, and increasing by one for each descendant generation
node.height - zero for leaf nodes, and the greatest distance from any descendant leaf for internal nodes
node.parent - the parent node, or null for the root node
node.children - an array of child nodes, if any; undefined for leaf nodes.
node.value - the summed value of the node and its descendants; optional, set by node.sum.

*/

var
  // config
  showNumbers = false,
  dataFile = "cognition.json",
  svg = d3.select("svg"),
  // dimensions +convert to number
  width = +svg.attr("width"),
  height = +svg.attr("height"),
  minSize = 800,
  textBoxWidth = 60,
  textBoxHeight = 200,
  // general spacing
  padding = 30,
  // middle of the diagram
  centerX = width / 2,
  centerY = height / 2,
  // radius of overall graph
  radius = width / 2,
  // tree radius
  dataRadius = radius * 0.5,
  // description distance from centre
  titleRadius = radius * 0.5,
  ringRadius = radius * 0.85,
  bubbleRadius = 8,
  // each little node circle
  nodeRadius = "0.2%",
  // how many degrees around do we draw on the tree
  coverage = 360 - (30),
  // cache the DOM elements
  elements = {},
  // JSON data
  loadedData,
  timings = {
        duration : {
            lines:25,
            circles:500,
            nodes:400
        },
        delay : {
            lines:15,
            circles:30,
            nodes:50
        }
  };

    /*
    ,
    offset : {
        lines:240,
        circles:400,
        nodes:200
    }
    */

// Resize this infographic...
var resize = function()
{
    var w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
        h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight,
        // determine which is smaller
        min = Math.min( w, h ),
        size = min < minSize ? minSize : min;

    svg.attr( "width", size ).attr( "height", size );
};

// Create a <tspan> wrapped textbox using the plugin from
// https://github.com/vijithassar/d3-textwrap
var wrap = d3.textwrap()
    // set fixed size for boxes
    .bounds({height: textBoxHeight, width: textBoxWidth})
    // wrap with tspans in all browsers
    .method('tspans');

// Take an x,y coord and project them radially
var project = function(x, distance)
{
	var angle = (x - 90) / 180 * Math.PI;
	return [distance * Math.cos(angle), distance * Math.sin(angle)];
};

// for radial data we want to give it a bit more room
// https://github.com/d3/d3-hierarchy/blob/master/README.md#tree_separation
var seperate = function(a,b)
{
	return (a.parent == b.parent ? 1 : 2) / a.depth;
};

// Create our tree diagram (one trunk, plenty of branches)
// using the Reingold–Tilford “tidy” algorithm
// https://github.com/d3/d3-hierarchy/blob/master/README.md#tree
var tree = d3.tree()
    // 360 degrees, radius
    .size([coverage, dataRadius])
    // how the nodes are distributed
    .separation(seperate);

    // timings.duration.lines
    // timings.duration.circles
    // timings.duration.node

    // timings.delay.lines
    // timings.delay.circles
    // timings.delay.node

// for staggered animations
var
    delayCircles = function(d,i)
    {
        // make sure that all of the lines have faded in already
        var pause = 0;//i.length * timings.duration.lines;
        // determine how many items are in this group...
        var quantity = d.parent ? d.parent.children.length : 1;
        //console.log( quantity, i%quantity);
    	return pause + (i%quantity * timings.delay.circles);
    },
    delayLines = function(d,i)
    {
        return i*timings.delay.lines;
    },
    delayNode = function(d,i)
    {
        return i * timings.delay.nodes;
    };

// Colour for item :)
var colours = function(item, index, completeData)
{
    // create colour
    var percent = ( index / completeData.length);
    //var colour = d3.hcl(255 *percent, 50, 20 );
    var colour = d3.hsl(355*percent, 1, 0.3 );
    var rgb = d3.rgb(colour);
    //console.log( { percent, index, length:completeData.length, rgb:rgb.toString(), colour} );
    return rgb.toString();
};

// Curvy lines :)
var lines = function(d,i)
{
    return !d.parent ? "M0,0" : "M" + project(d.x, d.y)
            + "C" + project(d.x, (d.y + d.parent.y) * 0.5)
            + " " + project(d.parent.x, (d.y + d.parent.y) * 0.5)
            + " " + project(d.parent.x, d.parent.y);
};

// feed it a complete data file and then specify the key you want to prune to
var dataFetchFromKey = function( dataSet , key )
{
    // loop through all children
    var traits = dataSet.children;
    //
    for ( var i=0,q=traits.length; i < q; ++i )
    {
        var branch = traits[i];
        if (key == branch.name)
        {
            // re-branch
            return {
                "name": dataSet.name,
                "children":[branch]
            }
        }
    }
    return loadedData;
};

// Events ----------------------------------------------------------------------
var
    onBackgroundClick = function(item, index, completeData)
    {
        redraw( loadedData );
    },
    // Click event
    onClick = function(item, index, completeData, event)
    {
        var group, family;
        switch (item.depth)
        {
            case 1:
                //console.log("Title",item.data.name);
                group = "All";
                family = item;
                break;

            case 2:
                //console.log("Description",item.data.name);
                group = "All";
                family = item.parent;
                break;

            // case 3:
            default:
                console.log("Trait",item.data.name);
                group = item.data.name;
                family = item.parent.parent;
        }

        // redraw...
        //console.error(item.depth, family.data.name, group, family );

        // filter descendants
        var trimmed = dataFetchFromKey(loadedData, family.data.name);
        console.error(trimmed, loadedData, family.data.name);
        redraw( trimmed, event.depth );

        // copy to clipboard...
        //selectAndCopyText();
    },
    onEvent = function(item, index, completeData)
    {
        var event = d3.event;
        switch (event.type)
        {
            case "click":
                onClick(item, index, completeData, event);
                break;

            case "mouseover":
                // update title...
                elements.heading.text( item.data.name );
                elements.subheading.text( item.data.name );
                break;

            case "mouseout":
                // reset titles
                elements.heading.text( loadedData.name );
                elements.subheading.text( loadedData.name );
                break;
        }

    };

var redraw = function( data, depth )
{
    console.error( {data, loadedData} );
    // check the depth of the data and if we are not at root level,
    // it is important to show the back button to allow the whole
    // Set the heading and the subheading to the sectional data...
    elements.heading.text( data.name );

    // remove existing elements
    elements.centredGroup.selectAll(".node").remove();

    var angles = [coverage, 270, 180, 90];

    /*
    // resize the tree
    tree = d3.tree()
       .size([ angles[depth], dataRadius ])
       .separation(seperate);
       */
    //tree.size([ angles[depth], dataRadius ]);
    // 360 degrees, radius
    draw(data, depth);
}

// Draw onto stage
var draw = function( data, depth )
{
    // 3. create our data & get the goodies out of there...
    var
        // convert data into a hierachy with children and parents
        // NB. you can filter this here to only show certain data sets...
        hierarchy = d3.hierarchy( data );
        // create a root data node from the tree and our main heirachy...
        dataTree = tree( hierarchy ),
        // and create the heirachy that we will use to populate the data...
        descendants = dataTree.descendants();

	// now fetch our .node elements
	elements.dataPoints = elements.centredGroup.selectAll(".node");

    var ring = elements.centredGroup
        .append("circle")
        .attr( "class", "description-ring")
        .attr( "r", ringRadius )
        .attr( "fill", "transparent" )
        .attr( "stroke", colours );

	// Create data nodes on entered...
    var groups = elements.dataPoints
        .data( descendants )
        .enter()
            // draw our graphic nodes
            .append("g")
            // add class depending on type...
            .attr("class", function(item, index, completeData) {
                return "node" + (" node-"+item.depth) + (item.children ? " node--internal" : " node--leaf");
            })
            .on("click mouseover mouseout", onEvent);

    // put a group in the node group
    var nodes = groups
        .append("g")
        .attr("transform", function(item, index, completeData) {
            // move using coordinates set in the tree algo
            return "translate(" + project(item.x, item.y) + ")";
        })
        .attr( "class", "endpoint");

    /*
    // draw and animate on data change
    dataPoints.update()
        .transition()
        .delay(function(d, i) {
            return i * 100;
        })
        .duration(1000);
    */

    // Lines -------------------------------------------------------------------
    // Lines between the nodes
	var connections = groups.append("path")
        // draw path lines as data points
        .attr( "d", lines )
        // add class name
        .attr( "class", "connection")
        // draw the lines inbetween the nodes
    	.attr( "stroke", colours )
        .attr( "stroke-dasharray", 1000 )
        .attr( "stroke-dashoffset", 1000 )
        // now animate in :);
        .transition()
        .duration( timings.duration.lines )
        .delay( delayLines )
        .attr( "stroke-dashoffset", 0 );


    // Circles -----------------------------------------------------------------
    // Draw some overlaying data :)
	// circles on the node points
	elements.circles = nodes.append("circle")
        .attr( "class", function(item,i) {
            return "blob circle-" + item.depth;
        })
        .attr( "r", 0)
        // transition in from tiny to regular
        .transition()
        .duration( timings.duration.circles )
        .delay( delayCircles )
        .attr( "fill", colours )
        // set radius depending on depth
        .attr( "r", function(d,i) {
            return d.children ? "1px" : nodeRadius;
        });


    // add some traits :)
    var traits = nodes
        // ensure we are only drawing traits...
        .filter(function(item, index, completeData){
            return !item.children;
        })
        .append( "g" )
        // rotate if neccessary
        .attr( "transform", function(d,i) {
            // use the depth (i) to set the position
            return "rotate(" + (d.x < 180 ? d.x - 90 : d.x + 90) + ")";
            return "translate(" + project(d.x, d.y) + ") rotate(" + (d.x < 180 ? d.x - 90 : d.x + 90) + ")";
        });

    // hit area
    traits.append("rect")
        .attr("x", function(d,i) {
            return d.x < 180 ? 0 : -100;
        })
        .attr( "y", -4)
        .attr( "fill", "transparent")
        .attr( "width", 160 )
        .attr( "height", 8 )

    // rotated text trait
    traits.append( "text")
        .attr( "class", "trait")
        // try and lower text
        .attr( "dy", ".33em")
        // set the coordinate for the text element
        .attr( "x", function(d,i) {
            return d.x < 180 === !d.children ? 6 : -6;
        })
        // fill with the correct colour for this item
        .attr( "fill", colours )
        // justify left or right depending on how rotated everything is
        .style("text-anchor", function(d,i) {
            return d.x < 180 === !d.children ? "start" : "end";
        })
        // set the text from the name of the JSON node
        .text(function(t,i) {
            return t.data.name;
        });


        // Descriptions ------------------------------------------------------------

        // add descriptions to the traits...
        var descriptions = nodes
            .filter(function(item, index, completeData){
                // descriptions are the first data sets that describe their children
                return item.depth === 2;
            })
            .append( "g")
            .attr( "class", "description")
            // set the coordinate for the text element
            // .attr( "x", function(d,i) {
            //     return 0;
            //     //return d.x < 180 === !d.children ? 6 : -6;
            // })
            // rotate if neccessary
            .attr( "transform", function(d,i) {
                // use the depth (i) to set the position
                return "translate(" + project(d.x, titleRadius+bubbleRadius) + ")";
            });

        descriptions.append( "circle" )
            .attr( "class", "description-blob")
            //.attr( "cy", "-12px")
            .attr( "r", "12px" )
            .attr( "fill", colours )
            .attr( "stroke-width", "6px" )
            .attr( "stroke", "white" );

        descriptions.append( "text" )
            // centralise y approx
            // .attr("dy", function(d,i) {
            //     var upsideDown = d.x < 90 || d.x > 270;
            //     return !upsideDown ? "56px" : "-56px";
            // })
            .attr("y", function(d,i) {
                var upsideDown = d.x < 90 || d.x > 270;
                return !upsideDown ? "26px" : "-26px";
            })
            //.attr("dx",textBoxWidth * 0.5)
            // rotate to face normal of the line
            .attr( "transform", function(d,i) {
                var upsideDown = d.x < 90 || d.x > 270;
                return "rotate(" + (!upsideDown ? d.x - 180 : d.x ) + ")";
            })
            // justify left or right depending on how rotated everything is
            .style( "text-anchor", function(d,i) {
                //return "start";
                return "middle";
                return d.x < 180 ? "start" : "end";
            })
            // set the text from the name of the JSON node
            .text(function(t,i) {
                return t.data.name;
            })
            // text wrap but preserve positions!
            .call(wrap);

    /*

    // now create our outer labels
    var sections = centredGroup
        .selectAll(".division")
        // populate with all children of parent node
        .data( subdivisions )
        // grab none-existant DOM items and continue
        .enter()
            // add a path to this node
            .append("text")
            .attr("class", "legend")
            .attr("transform", function(d,i) {
                // move depending on stuff
                return "rotate(" + (d.x < 180 ? d.x - 90 : d.x + 90) + ")";
            })
            .text( function(t,i) {
                var text = showNumbers ? (i+1) + ". " : "";
                return text + t.data.name;
            });

            */
    // now create our outer labels
    var legend = elements.centredGroup
        .selectAll(".legend")
        // populate with all children of parent node
        .data( descendants )
        .filter(function(item, index, completeData){
            // descriptions are the first data sets that describe their children
            return item.depth === 1;
        })
        // grab none-existant DOM items and continue
        .enter()
            // add a path to this node
            .append("text")
            .attr("class", "legend")
            .attr("transform", function(d,i) {
                // move depending on stuff
                return "translate(" + project(d.x, titleRadius) + ")";
            })
            .text( function(t,i) {
                var text = showNumbers ? (i+1) + ". " : "";
                return text + t.data.name;
            });

	// Data node has been removed
	var exit = elements.dataPoints
        .exit()
            .transition()
            .delay( delayNode )
            .duration( timings.duration.nodes )
            .remove();
};

// Draw shared base elements
var render = function( data )
{
    // Set viewbox to the whole size of the infographic
    svg.attr("viewBox", "0 0 "+width+" "+height );

    // 1. Add a title node to our root SVG node for accessibility
    elements.accessibility = svg.append("title").text( data.name );

    // 2. draw a bounding box
    elements.background = svg
        .append("rect")
            .attr( "x", 0)
            .attr( "y", 0)
            .attr( "class", "wallpaper")
            .attr( "width", width )
            .attr( "height",height )
            .attr( "fill", "transparent" )
            .on("click", onBackgroundClick);

    // 3. Add a large visual title
    // the sub dvisions and descriptions are at
    // data.children[0].children[0].name;
    elements.title = svg
        .append("text")
            .attr( "class", "title")
            // set the coordinate for the text element
            //.attr( "x", centerX-(dataRadius/2) )
            // the 6 here is just to align it with the outer size of the circles
            .attr( "x", -(dataRadius+2) )
            .attr( "dy", "0.28em" )
            .attr( "transform", function(d,i) {
                // use the depth (i) to set the position
                var mid = -(((360 - coverage)/2) + 270) ;
                var gap = 0;//150;//dataRadius * 0.5;
                return "translate(" + (centerX-gap) + "," + (centerY) + ")" + " " + "rotate(" + mid + ")";
            })
    		// left justify
            .style( "text-anchor", "start" )
            // animate :)
    		//.transition()
      		//.duration(2000)
            // set the text from the name of the JSON node .toUpperCase()
            .text( data.name );

    // 4. Add a large visual title
    // the sub dvisions and descriptions are at
    // data.children[0].children[0].name;
    elements.heading = svg
        .append("text")
            // set the coordinate for the text element
            //.attr( "x", centerX-(dataRadius/2) )
            // the 6 here is just to align it with the outer size of the circles
            .attr( "x", padding )
            .attr( "y", padding )
            .attr( "class", "heading")
            .style( "text-anchor", "start" )
            // animate :)
    		//.transition()
      		//.duration(2000)
            // set the text from the name of the JSON node .toUpperCase()
            .text( data.name );

    elements.subheading = svg
        .append("text")
            // set the coordinate for the text element
            //.attr( "x", centerX-(dataRadius/2) )
            // the 6 here is just to align it with the outer size of the circles
            .attr( "x", padding )
            .attr( "y", padding + 12 )
            .attr( "class", "subheading")
            .style( "text-anchor", "start" )
            // animate :)
    		//.transition()
      		//.duration(2000)
            // set the text from the name of the JSON node .toUpperCase()
            .text( data.name );

    // 7. Create a centralised group to hold our visualiser
    elements.centredGroup = svg.append("g")
        .attr( "transform", "translate(" + centerX + "," + centerY + ")")
        .attr( "class", "visualiser");

    // draw this data set
    loadedData = data;

    // original depth
    draw( data, 3 );
};

// now load in our data and project it radially :)
d3.json( dataFile, render );

// resize...
window.addEventListener('resize', resize, true);
resize();

}();
