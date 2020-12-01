/*
=-=-=-=-=-=-=-=-=-=-=-=-
Album Art Search
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID:
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/
const fs = require('fs');
const url = require("url");
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const credentials = require('./auth/credentials.json');

const port = 3000;
const server = http.createServer();

server.on("request", connection_handler);
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	let animeIDPass = 0;
	if(req.url === "/"){
		const main = fs.createReadStream("html/main.html");
      res.writeHead(200, {"Content-Type": "text/html"});
      main.pipe(res);
   }
	else if (req.url === "/favicon.ico"){
		const icon = fs.createReadStream("images/favicon.ico");
      res.writeHead(200, {"Content-Type": "image/x-icon"});
		icon.pipe(res);
   }
	else if (req.url === "/images/banner.gif"){
      res.writeHead(200, {"Content-Type": "image/gif"});
      const image_stream = fs.createReadStream("images/banner.gif");
		image_stream.pipe(res);
   }
	else if (req.url === "/images/chika.gif"){
      res.writeHead(200, {"Content-Type": "image/gif"});
      const image_stream = fs.createReadStream("images/chika.gif");
		image_stream.pipe(res);
   }
	else if (req.url.startsWith("/search")){
		const user_input = url.parse(req.url, true).query;
		const anime = user_input.anime;
		//getting information from trace.moe
		const whatanimeurl = `https://trace.moe/api/search?url=${anime}`;
		let animeReq = https.get(whatanimeurl, function(animeReq){
			stream_to_message(animeReq, message => whatanimeresults(message, res));
		});
		//parse response from what anime
		function whatanimeresults(message, res){
			let whatanimejson = JSON.parse(message);
			//grabbing english title
			let title = whatanimejson.docs[0].title_english;
			console.log(title);
			//creating api request
			let anilisturl = 'https://graphql.anilist.co'
			let variables = {"title":`${title}`};
			let reqData = JSON.stringify({
				'query':'query($title:String){Media(search:$title,type:ANIME){id episodes genres popularity}}',
				variables
			});
			console.log(reqData);
			let options = {
				'method':'POST',
				'headers':{
					'Content-Type':'application/json',
					'Accept':'application/json',
				},
			}
			//requesting information
			let anilistReq = https.request(anilisturl,options);
			anilistReq.on('error',error_handler);
			function error_handler(err){
				throw err;
			}
			anilistReq.once('response', post_auth_cb);
			function post_auth_cb(incoming_msg_stream){
				stream_to_message(incoming_msg_stream, message => createAniListInfo(message, res));
			}
			anilistReq.end(reqData);
			//use anilist data
			function createAniListInfo(message, res){
				let aniListInfo = JSON.parse(message);
				let animeID = aniListInfo.data.Media.id;
				animeIDPass = animeID;
				let episodes = aniListInfo.data.Media.episodes;
				let genre = aniListInfo.data.Media.genres;
				let popularity = aniListInfo.data.Media.popularity;
				let aniListFinalUrl = `https://anilist.co/anime/${animeID}`;
				//let the jokes begin
				let authURL = "https://anilist.co/api/v2/oauth/authorize?"
				let authInfo = {
					"client_id":`${credentials.id}`,
					"redirect_uri":"http://localhost:3000",
					
				}
				//begin webpage creation 
				console.log("generating final page");
				res.writeHead(200, {"Content-Type":"text/html"});
				//creating a webpage inline oh god
				res.end(`
<!DOCTYPE html>
<html>
	<head>
		<title>Anime Finder</title>
		<style>
			body, form{
				margin: 0 auto;
				max-width:652px;
				overflow-x:hidden;
				background-color:#CCCCFF;
			}
			fieldset{
				display: flex;
			}
		</style>
	</head>
	<body>
		<h1>Your photo came up as ${title}</h1>
		<h3>${title} is a ${genre} anime with ${episodes} episodes. Its popularity comes in at ${popularity}.</h3>
		<a href = "${title}"><p>Link to AniList Page</p></a>
		<img src="https://thispersondoesnotexist.com/image" style="width:120px;float:left;"/><p>Interested in adding this show to your list? <a href="https://anilist.co/api/v2/oauth/authorize?client_id=${credentials.id}&response_type=token">Click this link to do so!</a></p>
	</body>
</html>
				`);
			}
		}
		//parse response from https call
		function stream_to_message(stream, callback){
			let body = "";
			stream.on("data", (chunk) => body += chunk);
			stream.on("end", () => callback(body));
		}
   }
	//authorization to add to list
	else if (req.url.startsWith("/authorized")){
		const token = req.headers.cookie;
		console.log(token);
		res.writeHead(404, {"Content-Type": "text/html"});
      res.end(`<h1>Not yet implementated</h1>`);
	}
   else{
      res.writeHead(404, {"Content-Type": "text/html"});
      res.end(`<h1>404 Not Found</h1>`);
   }
}

server.on("listening", listening_handler);
function listening_handler(){
	console.log(`Now Listening on Port ${port}`);
}

server.listen(port);
