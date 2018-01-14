var express = require('express');
var app = express();
var mysql = require('mysql');
var define = require("node-constants")(exports);
var Client = require('node-rest-client').Client;

require('dotenv').load();

if(!process.env.MINE_HOST) { 
    console.error('Environmental variables not set!');
	process.exit(1);
}

define({
    TOP_SOURCE_COMMENT_QUERY: "SELECT domain AS source, urls, AVG_comment_count AS avg, STD_comment_count AS std FROM weekly_source_analysis WHERE urls > 3 ORDER BY AVG_comment_count DESC LIMIT 10;",
    TOP_SOURCE_REACTION_QUERY: "SELECT domain AS source, urls, AVG_reaction_count AS avg, STD_reaction_count AS std FROM weekly_source_analysis WHERE urls > 3 ORDER BY AVG_reaction_count DESC LIMIT 10;" ,
    TOP_SOURCE_SHARE_QUERY: "SELECT domain AS source, urls, AVG_share_count AS avg, STD_share_count AS std FROM weekly_source_analysis WHERE urls > 3 ORDER BY AVG_share_count DESC LIMIT 10;",
	TOP_URL_COMMENT_QUERY: "SELECT ANY_VALUE(url) AS url, ANY_VALUE(created_time) AS created_at, MAX(comment_count) AS max_reaction FROM mine.archive WHERE (TIME_TO_SEC(TIMEDIFF(NOW(), FROM_UNIXTIME(ANY_VALUE(`mine`.`archive`.`created_time`)))) / 60) < 10080 GROUP BY ogobjectid ORDER BY max_reaction DESC LIMIT 10;",
    TOP_URL_REACTION_QUERY: "SELECT ANY_VALUE(url) AS url, ANY_VALUE(created_time) AS created_at, MAX(reaction_count) AS max_reaction FROM mine.archive WHERE (TIME_TO_SEC(TIMEDIFF(NOW(), FROM_UNIXTIME(ANY_VALUE(`mine`.`archive`.`created_time`)))) / 60) < 10080 GROUP BY ogobjectid ORDER BY max_reaction DESC LIMIT 10;",
    TOP_URL_SHARE_QUERY: "SELECT ANY_VALUE(url) AS url, ANY_VALUE(created_time) AS created_at, MAX(share_count) AS max_reaction FROM mine.archive WHERE (TIME_TO_SEC(TIMEDIFF(NOW(), FROM_UNIXTIME(ANY_VALUE(`mine`.`archive`.`created_time`)))) / 60) < 10080 GROUP BY ogobjectid ORDER BY max_reaction DESC LIMIT 10;",
	TOP_REDDIT_HOTNESS_QUERY: "SELECT HIGH_PRIORITY url, created_time AS created_at, reddit_hotness_score FROM mine.top_reddit_hotness LIMIT 10;",
	TOP_OVERALL_TRENDING_QUERY: "SELECT HIGH_PRIORITY url, created_time AS created_at, url_trending_score AS overall_trending_score FROM mine.top_url_trending_score LIMIT 10;",
	TOP_SOURCE_TRENDING_QUERY: "SELECT HIGH_PRIORITY url, created_time AS created_at, source_trending_score FROM mine.top_source_trending_score LIMIT 10;",
	COUNT_OGOBJECTS_QUERY: "SELECT COUNT(*) AS c FROM ogobject;",
	COUNT_SOURCES_QUERY: "SELECT COUNT(DISTINCT domain) AS c FROM archive;",
	COUNT_OBSERVATIONS_QUERY: "SELECT COUNT(*) AS c FROM archive;"
});

define({
	MYJSON_TOPDOMAINS: "n78qh",
	MYJSON_TOPURLS: "sk56h",
	MYJSON_HOTNESS: "ttd9l",
	MYJSON_COUNTS: "j3kdl",
})


define('LONG_CACHE_DURATION', process.env.MINE_LONG_CACHE || 30);
define('SHORT_CACHE_DURATION', process.env.MINE_SHORT_CACHE || 10);
define('PORT', process.env.MINE_PORT || 8080);


const connection = mysql.createConnection({
  host: process.env.MINE_HOST,
  user: process.env.MINE_USER,
  password: process.env.MINE_PASSWORD,
  database: process.env.MINE_DB
});


var resultQuery = (function(query_text) {
	return new Promise((resolve, reject) => {
		connection.query(query_text, (err,rows) => {	
			if(err) {
				console.error('Error', err);
				return reject(err);
			}
			
			return resolve(rows);
		});
	});
});


app.get('/topdomains', function (req, res) {
	
	var now = new Date().toISOString();
	
	var topReactions = resultQuery(exports.TOP_SOURCE_REACTION_QUERY);
	var topComments = resultQuery(exports.TOP_SOURCE_COMMENT_QUERY);
	var topShares = resultQuery(exports.TOP_SOURCE_SHARE_QUERY);
	
	var allPromise = Promise.all([topReactions, topComments, topShares]);
	allPromise.then(function (data) {
			//console.log(data) // if
			var output = { 
				datetime: now,
				sources: {
					reaction: {
						name: 'Top 10 reactions',
						record: data[0]
					},
					comment: {
						name: 'Top 10 commenti',
						record: data[1]
					},
					share: {
						name: 'Top 10 condivisioni',
						record: data[2]
					}
				}
			}

			var client = new Client();
			
			var args = {
				path: { "id": exports.MYJSON_TOPDOMAINS },
				headers: { "Content-Type": "application/json" },
				data: JSON.stringify(output)
			};
			
			client.put("https://api.myjson.com/bins/${id}", args, function (data, response) {
				res.json(output); 
			});

		}, function (err) {
			console.error(err) 
			res.status(500).send('');
	});
	
})

app.get('/topurls', function (req, res) {
	
	var now = new Date().toISOString();
	
	var topReactions = resultQuery(exports.TOP_URL_REACTION_QUERY);
	var topComments = resultQuery(exports.TOP_URL_COMMENT_QUERY);
	var topShares = resultQuery(exports.TOP_URL_SHARE_QUERY);
	
	var allPromise = Promise.all([topReactions, topComments, topShares]);
	allPromise.then(function (data) {
			//console.log(data) // if
			var output = { 
				datetime: now,
				urls: {
					share: {
						name: 'Top 10 reactions',
						record: data[0]
					},
					comment: {
						name: 'Top 10 commenti',
						record: data[1]
					},
					reaction: {
						name: 'Top 10 condivisioni',
						record: data[2]
					}
				}
			}

			var client = new Client();
			
			var args = {
				path: { "id": exports.MYJSON_TOPURLS },
				headers: { "Content-Type": "application/json" },
				data: JSON.stringify(output)
			};
			
			client.put("https://api.myjson.com/bins/${id}", args, function (data, response) {
				res.json(output); 
			});

		}, function (err) {
			console.error(err) 
			res.status(500).send('');
	});
	
})

var formatRedditHotness = function(rh) {

	rh.forEach(element => {
		element.reddit_hotness_score = (parseFloat(element.reddit_hotness_score)/100).toFixed(4);
	});

	return rh;
}

var formatOverallTrendingScore = function(rh) {
	
	rh.forEach(element => {
		element.overall_trending_score = (parseFloat(element.overall_trending_score)*1000).toFixed(2);
	});
	
	return rh;
}

var formatSourceTrendingScore = function(rh) {
	
	rh.forEach(element => {
		element.source_trending_score = (parseFloat(element.source_trending_score)*1000).toFixed(2);
	});
	
	return rh;
}

app.get('/hotness', function (req, res) {
	
	var	now = new Date().toISOString();
	
	var redditTrending = resultQuery(exports.TOP_REDDIT_HOTNESS_QUERY);
	var overallTrending = resultQuery(exports.TOP_OVERALL_TRENDING_QUERY);
	var sourceTrending = resultQuery(exports.TOP_SOURCE_TRENDING_QUERY);
	
	var allPromise = Promise.all([redditTrending, overallTrending, sourceTrending]);
	allPromise.then(function (data) {
			//console.log(data) // if
			var output = { 
				datetime: now,
				trending_scores: {
					reddit_hotness: {
						name: 'Top 10 Reddit Hotness',
						record: formatRedditHotness(data[0])
					},
					overall_trending_score: {
						name: 'Top 10 Overall Trending Score',
						record: formatOverallTrendingScore(data[1])
					},
					source_trending_score: {
						name: 'Top 10 Source Trending Score',
						record: formatSourceTrendingScore(data[2])
					}
				}
			} 

			var client = new Client();
			
			var args = {
				path: { "id": exports.MYJSON_HOTNESS },
				headers: { "Content-Type": "application/json" },
				data: JSON.stringify(output)
			};
			
			client.put("https://api.myjson.com/bins/${id}", args, function (data, response) {
				res.json(output); 
			});

		}, function (err) {
			console.error(err) 
			res.status(500).send('');
	});
})


app.get('/counts', function (req, res) {
	
	var now = new Date().toISOString();
	
	var observations = resultQuery(exports.COUNT_OBSERVATIONS_QUERY);
	var objects = resultQuery(exports.COUNT_OGOBJECTS_QUERY);
	var sources = resultQuery(exports.COUNT_SOURCES_QUERY);
	
	var allPromise = Promise.all([observations, objects, sources]);
	allPromise.then(function (data) {
			//console.log(data) // if
			var output = { 
				datetime: now,
				counts: {
					observations:  data[0][0]['c'],
					objects:  data[1][0]['c'],
					sources:  data[2][0]['c'],
				}
			};

			var client = new Client();
			
			var args = {
				path: { "id": exports.MYJSON_COUNTS },
				headers: { "Content-Type": "application/json" },
				data: JSON.stringify(output)
			};
			
			client.put("https://api.myjson.com/bins/${id}", args, function (data, response) {
				res.json(output); 
			});
			

		}, function (err) {
			console.error(err) 
			res.status(500).send('');
	});
	
})

app.use((req, res) => {
  res.status(404).send('') //not found
})

var checkDBConnection = () => { connection.query('SELECT 1', (err,rows) => { if(err) throw err;	}); }

// Start server and listen on http://localhost:8080/
var server = app.listen(exports.PORT, function () {
    var host = server.address().address
    var port = server.address().port

    console.log("server listening at http://%s:%s", host, port)
	
	// checking DB connection
	checkDBConnection();
	
});



