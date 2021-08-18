const fs = require('fs');
const url = require("url");
const http = require('http');
const https = require('https');
const fetch = require('node-fetch');

const port = 4379;
const server = http.createServer();

let animeIDPass = 0;
server.on("request", connection_handler);
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	if(req.url === "/"){
		//let the jokes begin
		let fakePerson = https.get('https://thispersondoesnotexist.com/image', function(res){
			let fakeSave = fs.createWriteStream(`./cache/fakePerson.jpg`,{'encoding':null});
			res.pipe(fakeSave);
			fakeSave.on("finish",function(){
				console.log("Imaginary Person Saved Succesfully");
			});
			fakeSave.on('error',function(err){console.log(err)});
		});
		const main = fs.createReadStream(`./html/main.html`);
		res.writeHead(200, {"Content-Type": "text/html"});
		main.pipe(res);
	}
	else if(req.url === "/about.html"){
		const about = fs.createReadStream(`./html/about.html`);
		res.writeHead(200, {"Content-Type": "text/html"});
		about.pipe(res);
	}
	else if (req.url === "/favicon.ico"){
		const icon = fs.createReadStream(`./images/favicon.ico`);
		res.writeHead(200, {"Content-Type": "image/x-icon"});
		icon.pipe(res);
	}
	else if (req.url === "/images/mainicon.png"){
		const icon = fs.createReadStream(`./images/mainicon.png`);
		res.writeHead(200, {"Content-Type": "image/png"});
		icon.pipe(res);
	}

	else if (req.url === "/images/banner.gif"){
		res.writeHead(200, {"Content-Type": "image/gif"});
		const image_stream = fs.createReadStream(`./images/banner.gif`);
		image_stream.pipe(res);
	}
	else if (req.url === "/images/chika.gif"){
		res.writeHead(200, {"Content-Type": "image/gif"});
		const image_stream = fs.createReadStream(`./images/chika.gif`);
		image_stream.pipe(res);
	}
	else if (req.url.startsWith("/cache/")){
		let image_stream = fs.createReadStream(`.${req.url}`);
		image_stream.on("error",image_error_handler);
		function image_error_handler(err){
			res.writeHead(404, {"Content-Type":"text/plain"});
			res.write("404 Not Found", () => res.end());
		}
		image_stream.on("ready", deliver_image);
		function deliver_image(){
			res.writeHead(404, {"Content-Type":"text/plain"});
			image_stream.pipe(res);
		}
	}
	else if (req.url.startsWith("/search")){
		const user_input = url.parse(req.url, true).query;
		//all for pre use url checking
		function isValidUrl(string) {
			if(string.length > 500){
				return false;
			}
			if(!string.startsWith("https")){
				return false;
			}
			try {
				new URL(string);
			} catch (_) {
				return false;  
			}
				return true;
		}
		//sees if user entered a url
		if(isValidUrl(user_input.anime)){
			console.log("Valid Url");
			const anime = user_input.anime;
			console.log(anime);
			let photoname = anime.substring(anime.lastIndexOf('/')+1);
			//sees if url is an image
			if(photoname.includes(".jpg")||photoname.includes(".png")||photoname.includes(".jpeg")){
				console.log("Valid Photo");
				getanime();
				async function getanime(){
					console.log("getting info ready");
					//getting information from trace.moe
					await fetch(`https://api.trace.moe/search?anilistInfo&url=${encodeURIComponent(anime)}`).then(async (e) => {
						let eJson = await e.json(); 
						whatanimeresults(eJson,res)
					});
					//parse response from what anime
					function whatanimeresults(message, res){
						console.log("Title Gotten");
						if(message.hasOwnProperty('error')){
							res.writeHead(400, {"Content-Type": "text/html"});
							res.end(`<h1>400 Requested URL Not An Image</h1>`);
							return;
						}
						let whatanimejson = message;
						console.log(whatanimejson.result[0].anilist);
						//grabbing english title
						let title = "";
						//checks if actually grabbed image
						title = whatanimejson.result[0].anilist.title.english;
						if(title == null){
							title = whatanimejson.result[0].anilist.title.romaji;
						}
						console.log(title);
						//creating api request
						let anilisturl = 'https://graphql.anilist.co'
						let variables = {"title":`${title}`};
						let reqData = JSON.stringify({'query':'query($title:String){Media(search:$title,type:ANIME){id episodes genres popularity}}',variables});
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
							const animeInfo = `./cache/${animeID}.json`;
							if(!fs.existsSync(animeInfo)){
								let filedata = {
									"title":`${title}`,
									"id":`${animeID}`,
									"episodes":`episodes`,
									"genre":`${genre}`,
									"popularity":`${popularity}`
								};
								let inputData = JSON.stringify(filedata);
								fs.writeFile(animeInfo,inputData, (err) => {
									if(err) throw err;
									console.log("File Written Succesfully");
								});
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
							<img src="${anime}" style="width:100px;padding:10px;float:left;"><p>(Your photo for reference)</p>
							<h3 style="clear:left;">${title} is a ${genre} anime with ${episodes} episodes. Its popularity comes in at ${popularity}.</h3>
							<a href = "${aniListFinalUrl}"><p>Link to AniList Page</p></a>
							<img src="./cache/fakePerson.jpg" style="width:120px;float:left;padding:10px"/><p style="font-family: 'Bradley Hand', cursive;">I love this show. If you want to go back to the start <a href="./">Click here</p></a>
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
			}
			else{
				res.writeHead(400, {"Content-Type": "text/html"});
				res.end(`<h1>400 Requested URL Not An Image</h1>`);
			}
		}
		else{
			res.writeHead(400, {"Content-Type": "text/html"});
			res.end(`<h1>400 Invalid URL Entered</h1>`);
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

