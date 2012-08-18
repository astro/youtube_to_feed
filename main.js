if (process.argv.length < 4) {
    console.error("Usage: " + process.argv[0] +
		  " " + process.argv[1] +
		  " <youtube | vimeo> <user name> [flattr user name] [output feed base path]");
    process.exit(1);
}
var SERVICE = process.argv[2];
var USER_NAME = process.argv[3];
var FLATTR_USER = process.argv[4];
var BASE_PATH = process.argv[5] || "";

var spawn = require('child_process').spawn;
var async = require('async');
var ltx = require('ltx');
var YF = require('youtube-feeds');
var Vimeo = require('n-vimeo');

function outputFeed(err, items) {
    if (!err) {
	process.stdout.write(itemsToAtom(items).toString());
	process.stdout.write("\n");
    } else {
	console.error(err);
    }
}

if (SERVICE == 'youtube') {
    YF.feeds.videos({ author: USER_NAME }, function(feeds) {
	async.mapSeries(feeds.items, function(item, cb) {
	    downloadVideo(item.player.default, function(err, name) {
		if (err) {
		    cb(err);
		} else {
		    item.fileName = name;
		    cb(null, item);
		}
	    });
	}, outputFeed);
    });
} else if (SERVICE == 'vimeo') {
    Vimeo.user(USER_NAME, 'videos', function(err, data) {
	async.mapSeries(data.body, function(item, cb) {
	    downloadVideo(item.url, function(err, name) {
		if (err) {
		    cb(err);
		} else {
		    item.fileName = name;
		    cb(null, item);
		}
	    });
	}, outputFeed);
    });
} else
    throw "Unknown service type " + SERVICE;


function exec(prog, args, cb) {
    console.warn("$ " + prog + " " + args.join(" "));
    var e = spawn(prog, args);
    var out = "";
    e.stdout.setEncoding('utf8');
    e.stdout.on('data', function(d) {
	out += d;
    });
    var err = "";
    e.stderr.on('data', function(d) {
	err += d;
    });
    e.on('exit', function(code) {
	if (code == 0) {
	    cb(null, out);
	} else {
	    cb(new Error(err));
	}
    });
}

/**
 * cb: [Function] cb(error, fileName);
 */
function downloadVideo(url, cb) {
    exec('cclive', ["-f", "best", "-c", url, "--exec", "echo '%n'"], function(err, out) {
	cb(err, out && out.split(/\n/)[0]);
    });
}


var NS_ATOM = 'http://www.w3.org/2005/Atom';
var MIME_HTML = 'text/html';
var MIME_JPEG = 'image/jpeg';

function itemsToAtom(items) {
    var title = SERVICE == 'youtube' ?
	    "YouTube: " + USER_NAME :
	    SERVICE == 'vimeo' ?
	    "Vimeo: " + USER_NAME :
	    USER_NAME;
    var feed = new ltx.Element('feed', { xmlns: NS_ATOM }).
	c('title').t(title).up().
	c('link', { rel: 'alternate',
		    type: MIME_HTML,
		    href: "http://youtube.com/user/" + USER_NAME }).up();
    items.forEach(function(item) {
	if (!item.fileName)
	    return;

	var entry = feed.c('entry');
	var published = item.uploaded || item.upload_date.replace(" ", "T");
	var updated = item.updated || published;
	entry.
	    c('title').t(item.title).up().
	    c('published').t(published).up().
	    c('updated').t(updated).up().
	    c('summary', { type: (SERVICE == 'vimeo' ? 'html' : 'text' }).
	        t(item.description).up().
	    c('link', { rel: 'alternate',
			type: MIME_HTML,
			href: (item.player && item.player.default) || item.url }).up().
	    c('link', { rel: 'logo',
			type: MIME_JPEG,
			href: (item.thumbnail && item.thumbnail.sqDefault) || item.thumbnail_small }).up().
	    c('logo').t((item.thumbnail && item.thumbnail.hqDefault) || item.thumbnail_large).up().
	    c('link', { rel: 'enclosure',
			href: BASE_PATH + encodeURIComponent(item.fileName) });
	    if (FLATTR_USER)
		entry.
		    c('link', { rel: 'payment',
				type: MIME_HTML,
				href: makeFlattrLink(item) });
    });
    return feed;
}

function makeFlattrLink(item) {
    var args = {
	user_id: FLATTR_USER,
	url: item.player.default,
	title: item.title,
	description: item.description,
	tags: item.tags.join(","),
	category: 'video'
    };
    return "https://flattr.com/submit/auto?" +
	Object.keys(args).map(function(k) {
	    return k + "=" + encodeURIComponent(args[k]);
	}).join("&");
}

