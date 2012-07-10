var USER_NAME = process.argv[2];
var BASE_PATH = process.argv[3] || "";

if (!USER_NAME) {
    console.error(process.argv[0] + " <user name> [base path]");
    process.exit(1);
}

/**
 * Customize this:
 */
var FLATTR_USER = 'Astro';

var spawn = require('child_process').spawn;
var async = require('async');
var ltx = require('ltx');
var YF = require('youtube-feeds');

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
    }, function(err, items) {
	if (!err) {
	    process.stdout.write(itemsToAtom(items).toString());
	    process.stdout.write("\n");
	} else {
	    console.error(err);
	}
    });
});



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
    var feed = new ltx.Element('feed', { xmlns: NS_ATOM }).
	c('title').t("YouTube: " + USER_NAME).up().
	c('link', { rel: 'alternate',
		    type: MIME_HTML,
		    href: "http://youtube.com/user/" + USER_NAME }).up();
    items.forEach(function(item) {
	if (!item.fileName)
	    return;

	feed.c('entry').
	    c('title').t(item.title).up().
	    c('published').t(item.uploaded).up().
	    c('updated').t(item.updated).up().
	    c('summary').t(item.description).up().
	    c('link', { rel: 'alternate',
			type: MIME_HTML,
			href: item.player.default }).up().
	    c('link', { rel: 'logo',
			type: MIME_JPEG,
			href: item.thumbnail.sqDefault }).up().
	    c('logo').t(item.thumbnail.hqDefault).up().
	    c('link', { rel: 'enclosure',
			href: BASE_PATH + encodeURIComponent(item.fileName) }).up().
	    c('link', { rel: 'payment',
			type: MIME_HTML,
			href: makeFlattrLink(item) }).up();
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

