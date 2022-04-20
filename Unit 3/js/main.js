
(function(){

    //pseudo-global variables
    var attrArray = ["Cropland", "Grassland", "Forest", "Special-use","Urban","Miscellaneous"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.37,
        chartHeight = 510
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([500, 0])
        .domain([0, 100]);
    
    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

        //map frame dimensions
        var width = window.innerWidth * 0.57 ,
        height = 500;


        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection for US
        var projection = d3.geoAlbersUsa()

        //create a path generator    
        var path = d3.geoPath()
            .projection(projection);

        var promises = [];    
        promises.push(d3.csv("data/LandUse_Percentage.csv")); //load attributes from csv     
        promises.push(d3.json("data/cb_2018_us_state_5m.topojson")); //load choropleth spatial data    
        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0],state = data[1];
            
            //place graticule on the map
            setGraticule(map, path);
                
            var stateBoundaries = topojson.feature(state, state.objects.cb_2018_us_state_5m).features;
       
            //join csv data to GeoJSON enumeration units
            stateBoundaries = joinData(stateBoundaries,csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);
            
            //add enumeration units to the map
            setEnumerationUnits(stateBoundaries, map, path,colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            addText();

            createDropdown(csvData);

        };
    };

function setGraticule(map,path){
    var graticule = d3.geoGraticule()
    .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

}

function joinData(stateBoundaries,csvData){ 
    //variables for data join
    var attrArray = ["Cropland", "Grassland", "Forest", "Special-use","Urban","Miscellaneous"];
    //loop through csv to assign each set of csv attribute values to state
    for (var i=0; i<csvData.length; i++){
        var csvState = csvData[i]; //the current state
        var csvKey = csvState.State; //the CSV primary key is its name
            
        //loop through geojson state to find correct state
        for (var a=0; a<stateBoundaries.length; a++){

            var geojsonProps = stateBoundaries[a].properties; //the current state geojson properties
            var geojsonKey = geojsonProps.NAME; //the geojson primary key is its name
            
            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvState[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
    
    return stateBoundaries
}

function setEnumerationUnits(stateBoundaries,map,path,colorScale){
    //add states
    var states = map.selectAll(".states")
        .data(stateBoundaries)
        .enter()
        .append("path")
        .attr("class", function(d){
            
            return "states "+ d.properties.NAME.replace( /\s/g, ''); //remove the space in the state name
        })
        .attr("d", path)       
        .style("fill", function(d){            
            var value = d.properties[expressed];            
            if(value) {                
                return colorScale(d.properties[expressed]);            
            } else {                
                return "#ccc";            
            }
        })
        .on("mouseover", function(event, d){
            highlight(d.properties);
        })
        .on("mouseout", function(event, d){
            dehighlight(d.properties);
        })
        .on("mousemove", moveLabel);

    var desc = states.append("desc").text('{"stroke": "#000", "stroke-width": "0.5px"}');


}

//function to create color scale generator
function makeColorScale(data){
    var colorClasses = [
        "#ffffcc",
        "#c2e699",
        "#78c679",
        "#31a354",
        "#006837"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
}

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.37,
        chartHeight = 510
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([500, 0])
        .domain([0, 100]);

    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.State.replace( /\s/g, '');//remove the space from the state name
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        .on("mouseover", function (event, d) {
            highlight(d);
        })
        .on("mouseout", function(event, d){
            dehighlight(d);
        })
        .on("mousemove", moveLabel);

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Percentage " + expressed + " by State");

    updateChart(bars, csvData.length, colorScale);

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

    var desc = bars.append("desc").text('{"stroke": "none", "stroke-width": "0px"}');
}

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
        changeAttribute(this.value, csvData)
    });;

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });

    
}

//dropdown change event handler
function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var regions = d3.selectAll(".states")
    .transition()
    .duration(1000)
    .style("fill", function(d){            
        var value = d.properties[expressed];            
        if(value) {                
            return colorScale(value);           
        } else {                
            return "#ccc";            
        }    
});
    //Sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //Sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
    updateChart(bars, csvData.length, colorScale);
}
//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 500 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){            
            var value = d[expressed];            
            if(value) {                
                return colorScale(value);            
            } else {                
                return "#ccc";            
            }    
    });
    var chartTitle = d3.select(".chartTitle")
        .text("Percentage " + expressed + " by State");
}

//function to highlight enumeration units and bars
function highlight(props){
    //the name of the state is stored differently in the csv and geojson data
    //use conditional to access the state name differently depending on the data source
    if(props['id']<100){ 
        var selected = d3.selectAll("." + props.State.replace( /\s/g, ''))//remove the space from state name 
            .style("stroke", "red")
            .style("stroke-width", "2");
    }else{
        var selected = d3.selectAll("." + props.NAME.replace( /\s/g, ''))//remove the space from the state name
            .style("stroke", "red")
            .style("stroke-width", "3");

    }
    setLabel(props);
};

//function to reset the element style on mouseout
//use conditional to access the state name differently depending on the data source
function dehighlight(props){
    if(props['id']<100){
        var selected = d3.selectAll("." + props.State.replace( /\s/g, ''))//remove the space from state name
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });
    }else{
        var selected = d3.selectAll("." + props.NAME.replace( /\s/g, ''))//remove the space from state name
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });
    }
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel")
        .remove();
};

//function to create dynamic label
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +"%"+
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")//show sate name on the map label
        .attr("class", "labelname")
        .html(props.NAME);

    var barName = infolabel.append("div")//show sate name on the bar chart label
        .attr("class", "labelname")
        .html(props.State);
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = event.clientX + 10,
        y1 = event.clientY - 75,
        x2 = event.clientX - labelWidth - 10,
        y2 = event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
//add description of land classes below the map and chart
function addText(){ 
    var text = d3.select("body")
        .append("div") //insert a div element with the given text
        .attr("class", "textTitle") //style differently from body
        .html('Land Classes:') //text to insert
    var cropland= d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Cropland:</b> Land planted for crops, cropland used for pasture, idled cropland, or failed cropland.  ')
    var grassland = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Grassland:</b> All land used for pasture or grazing but not crops. Must be open land with <10% tree cover. ')
    var forest = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Forest:</b> Land with at least 10% tree cover. Does not include cultivated trees.')
    var specialUse = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Special Use:</b> Includes, roads,railroads,airports, parks, wilderness areas, and military land.')
    var urban = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Urban:</b> Defined by the US Census. Includes areas at least 1000 people per square mile.')
    var miscellaneous = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<b>Miscellaneous:</b> Anything not classified under other land uses. Examples include cemeteries, golf courses, desert, and tundra.')
    var note = d3.select("body")
        .append("div")
        .attr("class", "text")
        .html('<i>*data and land classes from USDA, 2012<i>')

    }

})();
