
(function(){

    //pseudo-global variables
    var attrArray = ["Cropland", "Grassland", "Forest", "Special-use","Urban","Miscellaneous"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute
    
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
        /*
            //add states to map
            var states = map.selectAll(".states")
            .data(stateBoundaries)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states ";
            })
            .attr("d", path);
        */
            //join csv data to GeoJSON enumeration units
            stateBoundaries = joinData(stateBoundaries,csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);
            
            //add enumeration units to the map
            setEnumerationUnits(stateBoundaries, map, path,colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

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
/*
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
*/
};

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
};

function setEnumerationUnits(stateBoundaries,map,path,colorScale){
    //add states
    var states = map.selectAll(".states")
        .data(stateBoundaries)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "states ";
        })
        .attr("d", path)
        .attr("d", path)        
            .style("fill", function(d){            
                var value = d.properties[expressed];            
                if(value) {                
                    return colorScale(d.properties[expressed]);            
                } else {                
                    return "#ccc";            
                }    
        });
        

};

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
};

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
        .range([463, 0])
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
            return "bar " + d.State;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        .attr("height", function(d, i){
            return 500 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        .style("fill", function(d){
            return colorScale(d[expressed]);
        });

    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Percentage " + expressed + " by State");

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
};


})();
