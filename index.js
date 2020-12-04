const fs = require('fs');
const url = require("url");
const http = require('http');
const https = require('https');
const querystring = require('querystring');

//change depending on env
const workingDirectory = '.';
const credentials = require('./auth/credentials.json');
const network = 'http://localhost:4379';

const port = 4379;
const server = http.createServer();

let animeIDPass = 0;
server.on("request", connection_handler);
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	if(req.url === "/"){
		//let the jokes begin
		let fakePerson = https.get('https://thispersondoesnotexist.com/image', function(res){
			let fakeSave = fs.createWriteStream(`${workingDirectory}/cache/fakePerson.jpg`,{'encoding':null});
			res.pipe(fakeSave);
			fakeSave.on("finish",function(){
				console.log("Imaginary Person Saved Succesfully");
			});
			fakeSave.on('error',function(err){console.log(err)});
		});
		const main = fs.createReadStream(`${workingDirectory}/html/main.html`);
      res.writeHead(200, {"Content-Type": "text/html"});
      main.pipe(res);
   }
   else if(req.url === "/about.html"){
		const about = fs.createReadStream(`${workingDirectory}/html/about.html`);
      res.writeHead(200, {"Content-Type": "text/html"});
      about.pipe(res);
   }
	else if (req.url === "/favicon.ico"){
		const icon = fs.createReadStream(`${workingDirectory}/images/favicon.ico`);
      res.writeHead(200, {"Content-Type": "image/x-icon"});
		icon.pipe(res);
   }
	else if (req.url === "/images/mainicon.png"){
		const icon = fs.createReadStream(`${workingDirectory}/images/mainicon.png`);
      res.writeHead(200, {"Content-Type": "image/png"});
		icon.pipe(res);
   }

	else if (req.url === "/images/banner.gif"){
      res.writeHead(200, {"Content-Type": "image/gif"});
      const image_stream = fs.createReadStream(`${workingDirectory}/images/banner.gif`);
		image_stream.pipe(res);
   }
	else if (req.url === "/images/chika.gif"){
      res.writeHead(200, {"Content-Type": "image/gif"});
      const image_stream = fs.createReadStream(`${workingDirectory}/images/chika.gif`);
		image_stream.pipe(res);
   }
	else if (req.url.startsWith("/cache/")){
      let image_stream = fs.createReadStream(`${workingDirectory}${req.url}`);
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
			let photoname = anime.substring(anime.lastIndexOf('/')+1);
			//sees if url is an image
			if(photoname.includes(".jpg")||photoname.includes(".png")||photoname.includes(".jpeg")){
				console.log("Valid Photo");
				//downloads the image into cache
				let filepath = `${workingDirectory}/cache/`;
				let fullpath = `${filepath}${photoname}`;
				let imgReq = https.get(anime, function(res){
					let newImg = fs.createWriteStream(fullpath,{'encoding':null});
					res.pipe(newImg);
					//image done
					newImg.on("finish",function(){
						console.log("Upload Image Saved Succesfully");
						getanime();
					});
					//writing error
					newImg.on('error',function(err){
						res.writeHead(404, {"Content-Type": "text/html"});
					   res.end(`<h1>Failed To Write Image</h1>`);
						return;
					});
				});
				//url is a photo but is unreachable
				imgReq.on('error',function(err){
					res.writeHead(404, {"Content-Type": "text/html"});
					res.end(`<h1>Input URL Unreachable</h1>`);
					return;
				});
				function getanime(){
					console.log("getting info ready");
					//getting information from trace.moe
					const whatanimeurl = `https://trace.moe/api/search`;
					let base64img = fs.readFileSync(fullpath,'base64');
					const whatanimeoptions = {
						'method':'POST',
						'headers':{
							'Content-Type':'application/json'
						}
					}
					const whatanimedata = JSON.stringify({
						'image':`${base64img}`
					});
					console.log("searching trace.moe");
					let animeReq = https.request(whatanimeurl, whatanimeoptions);
					animeReq.on('response',(results) => {
						stream_to_message(results, message => whatanimeresults(message, res));
					});
					animeReq.on('error', function(err){console.log(err);});
					animeReq.end(whatanimedata);
					//parse response from what anime
					function whatanimeresults(message, res){
						console.log("Title Gotten");
						let whatanimejson = JSON.parse(message);
						//grabbing english title
						let title = "";
						//checks if actually grabbed image
						try{
							title = whatanimejson.docs[0].title_english;
						}
						catch(err){
							res.writeHead(404, {"Content-Type": "text/html"});
									res.end(`<h1>Invalid Image Formet</h1>
								 <p>Make sure your image URL ends in a file extension</p>`);
							return;
						}
						console.log(title);
						//creating api request
						let anilisturl = 'https://graphql.anilist.co'
						let variables = {"title":`${title}`};
						let reqData = JSON.stringify({
							'query':'query($title:String){Media(search:$title,type:ANIME){id episodes genres popularity}}',
							variables
						});
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
							const animeInfo = `${workingDirectory}/cache/${animeID}.json`;
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
							const redirectUrl = querystring.stringify({"redirect_uri":`${network}/authorized`});
							console.log(redirectUrl);
							const authURL = "https://anilist.co/api/v2/oauth/authorize?"
							const authquery = {
								"client_id":`${credentials.client_id}`,
								"redirect_uri":`${network}/authorized`,
								"response_type":"code"
							}
							const queryReq = querystring.stringify(authquery);
							const completeURL = `${authURL}${queryReq}`;
							console.log(completeURL);
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
									<img src="./cache/${photoname}" style="width:100px;padding:10px;float:left;"><p>(Your photo for reference)</p>
									<h3 style="clear:left;">${title} is a ${genre} anime with ${episodes} episodes. Its popularity comes in at ${popularity}.</h3>
									<a href = "${aniListFinalUrl}"><p>Link to AniList Page</p></a>
									<img src="./cache/fakePerson.jpg" style="width:120px;float:left;padding:10px"/><p style="font-family: 'Bradley Hand', cursive;">I love this show, Interested in adding this show to your list? <a href="${completeURL}">Click this link to do so!</a> If you want to go back to the start <a href="./">Click here instead</p></a>
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
	//authorization to add to list
	else if (req.url.startsWith("/authorized")){
		const authtoken = url.parse(req.url, true).query;
		const token = authtoken.code;
		const authoptions = {
			"uri":"https://anilist.co/api/v2/oauth/token",
			"method":"POST",
			"headers":{
				"Content-Type":"application/json",
				"Accept":"application/json"
			}
		};
		const authdata =JSON.stringify({
			"grant_type":"authorization_code",
			"client_id":`${credentials.client_id}`,
			"client_secret":`${credentials.client_secret}`,
			"redirect_uri":`${network}/authorized`,
			"code":`${token}`
		});
		const authreq = https.request("https://anilist.co/api/v2/oauth/token", authoptions);
		authreq.on('error', (err) => {
			console.log(err);
			console.log(authreq);
			res.writeHead(404, {"Content-Type": "text/html"});
			res.end(`<h1>Failed To Authenticate</h1>`);
		});
		authreq.on('response', post_auth_cb);
		function post_auth_cb(incoming_msg_stream){
			stream_to_message(incoming_msg_stream, message => addToList(message, res));
		}
		authreq.end(authdata);
		//parse response from https call
		function stream_to_message(stream, callback){
			let body = "";
			stream.on("data", (chunk) => body += chunk);
			stream.on("end", () => callback(body));
		}
		function addToList(message, res){
			const animeIDHold = animeIDPass;
			const parsedmessage = JSON.parse(message);
			const token = parsedmessage.access_token;
			let endpoint = 'https://graphql.anilist.co';
			let options = {
				"method": "POST",
				"headers": {
					"Authorization": `Bearer ${token}`,
					"Content-Type":"application/json",
					"Accept":"application/json"
				}
			}
			let query = 'mutation($mediaId:Int, $status: MediaListStatus){SaveMediaListEntry(mediaId: $mediaId, status: $status){id status}}';
			let variables = {"mediaId":`${animeIDHold}`,"status":"PLANNING"};
			let reqData = JSON.stringify({
				query,
				variables
			});
			//requesting information
			let anilistReq = https.request(endpoint,options);
			anilistReq.on('error',error_handler);
			function error_handler(err){
				throw err;
			}
			anilistReq.once('response', post_auth_cb);
			function post_auth_cb(incoming_msg_stream){
				stream_to_message(incoming_msg_stream, message => addedToList(message, res));
			}
			anilistReq.end(reqData);
			//parse response from https call
			function stream_to_message(stream, callback){
				let body = "";
				stream.on("data", (chunk) => body += chunk);
				stream.on("end", () => callback(body));
			}
			//creates final page
			function addedToList(message, res){
				let resultsInfo = JSON.parse(message);
				let id = resultsInfo.mediaId;
				let status = resultsInfo.status;
				let cache = `${workingDirectory}/cache/${animeIDHold}`;
				let animeInfo = require(cache);
				res.writeHead(200, {"Content-Type": "text/html"});
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
						<h1>${animeInfo.title} has been added to your list!</h1>
						<a href ="https://anilist.co/anime/${animeInfo.id}"><p>Link to the show</p></a>
						<img src="./cache/fakePerson.jpg" style="width:120px;float:left;padding:10px"/><p style="font-family: 'Bradley Hand', cursive;">Thank you for adding this show, you'll love it. Wanna search again? <a href="./">Click here to go back to the start</p></a>
					</body>
				</html>
				`);
			}
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

