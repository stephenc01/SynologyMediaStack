#!/usr/local/bin/node 
//Initial Testing
//non prod
const yargs = require('yargs'), exec = require('child_process'), request = require('sync-request'), os = require('os'), fs 
= require('fs'), crypto = require('crypto');


const argv = yargs
	.command('cleandocker','Prune docker images and volumes', {})
	/*.command('updatedocker','Update Docker Images', {
		checkonly: {
			description: 'Check Only',
		}
	})*/
	.command('updateplex','Download and upload plex', {
		plexpass: {
			description: 'Plex Pass?',
			alias: 'pp',
			type: 'boolean',
		},
		checkonly: {
			description: 'Check Only',
			type: 'boolean',
		}
	})
	.command('deploywatchtower', 'Deploy or update watchtower', {})
	.help()
	.alias('help','h')
	.argv;

if(argv._.includes('cleandocker')) {
	//console.log("Clean Docker");
	CleanDocker();
}else if(argv._.includes('updateplex')) {
	UpdatePlex();
}else if(argv._.includes('updatedocker')) {
	UpdateDocker();
}else if(argv._.includes('deploywatchtower')) {
	DeployWatchtower();
}

function DeployWatchtower() {
	var DockerImages = exec.execSync('docker ps -a --format "{{.Names}}"').toString().trim();
	var DockerRegex = /(.*(?:jacket|hydra|nzbget|watchtower|heimdall|lidarr|haproxy|ombi|bitcoind|sonarr|radarr).*)/gm;
	var DockerImagestoWatch = '';
	while((result = DockerRegex.exec(DockerImages)) !== null) {
		//console.log(result[0]);
		DockerImagestoWatch += result[0] + ' ';
	}

	try {
		var WT_Cleanup = exec.execSync('docker stop watchtower;docker rm watchtower').toString();
	} catch (error) {}
	var WT_Pull = exec.execSync('docker pull v2tec/watchtower:latest').toString();
	var WT_Create = exec.execSync('docker run -d --name watchtower -v /var/run/docker.sock:/var/run/docker.sock v2tec/watchtower ' + DockerImagestoWatch + ' --debug');
	console.log(WT_Cleanup,WT_Pull,WT_Create);
		
	//console.log(DockerImagestoWatch);
}

function UpdateDocker() {
	//var DockerImages = exec.execSync('docker images').toString();
	//var DockerContainers = exec.execSync('docker ps -a').toString();
	//console.log(DockerImages,DockerContainers);
}

function UpdatePlex(){
	//Credit for this logic goes here https://github.com/martinorob/plexupdate/blob/master/plexupdate.sh#L24
	console.log("Update Plex");
	
	//Get Current PlexVersion
	var PlexVersionCurrent = exec.execSync('synopkg version "Plex Media Server"').toString().trim();

	//console.log(PlexVersionCurrent);

	//get web plex updates
	var updateURL = 'https://plex.tv/api/downloads/5.json'
	if(argv.plexpass) {
		updateURL += '?channel=plexpass';
	}

	var PlexJson = JSON.parse(request('get',updateURL).body.toString());
	var PlexVersionWeb = PlexJson.nas.Synology.version.toString().trim();

	console.log('Installed Plex Version=>',PlexVersionCurrent,' --  Web Plex Version =>',PlexVersionWeb);

	if(PlexVersionCurrent != PlexVersionWeb) {
		//console.log('New Plex Version:',PlexVersionWeb,'');
	
		if(!argv.checkonly){
			//Add support for 32bit
			//console.log(PlexJson.nas.Synology);
			for(var i = 0; i < PlexJson.nas.Synology.releases.length; i++) {
				var release = PlexJson.nas.Synology.releases[i];
				if(release.build == 'linux-x86_64') {
					console.log(release.url,release.checksum);
					var file = request('get',release.url).body;
					if(checksum(file,'sha1') == release.checksum) {
						 fs.writeFileSync('plex.spk',file);
						 var InstallStatus = exec.execSync('synopkg install plex.spk').toString();
						//check install status
						//Good Install plex.spk install successfully
						//Missing Synology certificate Failed to install package plex.spk, error = [289]
						// 
						console.log('InstallStatus');
						//start service
						//validate output package Plex Media Server start successfully
						exec.execSync('synopkg start "Plex Media Server"').toString();
					} else {
						console.log("Checksum failure");
					}
				}
			}
		}
	}

	

	//console.log(PlexVersion);
	console.log(os.arch());
	/*exec('synopkg list | grep Plex', (err, stdout, stderr) => {
		//var RegexVersion = '^(Plex.*):';
		console.log(stdout.match(/^(Plex.*):/)[1]);
		 //console.log(`stdout: ${stdout}`);
	*/
}

function CleanDocker() {
	console.log(exec.execSync('docker image prune -f;docker volume prune -f').toString());
}

function checksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex')
}
