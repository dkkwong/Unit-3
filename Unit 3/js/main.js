//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 880,
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
        var csvData = data[0],
            state = data[1];
            

    var stateBoundaries = topojson.feature(state, state.objects.cb_2018_us_state_5m).features;
    
    var graticule = d3.geoGraticule()
    .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

    //create graticule background
    var gratBackground = map.append("path")
        .datum(graticule.outline()) //bind graticule background
        .attr("class", "gratBackground") //assign class for styling
        .attr("d", path) //project graticule

    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
        
    //add states
    var states = map.selectAll(".states")
        .data(stateBoundaries)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "states ";
        })
        .attr("d", path);
    console.log(states)

    }
};


