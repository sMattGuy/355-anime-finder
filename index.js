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
	
	else if (req.url.startsWith("/search")){
		const user_input = url.parse(req.url, true).query;
		const anime = user_input.anime;
		console.log(`${anime}`);
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
				'query':'query($title:String){Media(search:$title,type:ANIME){id}}',
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
				console.log(aniListInfo);
				let animeID = aniListInfo.data.Media.id;
				let aniListFinalUrl = `https://anilist.co/anime/${animeID}`;
				
				//begin webpage creation 
				console.log("generating final page");
				res.writeHead(200, {"Content-Type":"text/html"});
				
				res.end(`
				<a href = "${aniListFinalUrl}"><p>here you go king</p></a>
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
