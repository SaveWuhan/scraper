const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const Mercury = require('@postlight/mercury-parser');
const unified = require('unified');
const remark = require('remark');
const HTMLToMarkdown = require('rehype-remark');
const parseHTML = require('rehype-parse');
const stringifyMarkdown = require('remark-stringify');
const remove = require('unist-util-remove');
const visitor = require('unist-util-visit');
const cloudinary = require('cloudinary');
const axios = require('axios');

const freeImgurUpLoadURL = `https://api.imgur.com/3/upload`;
const imgurUploadURL = `https://imgur-apiv3.p.rapidapi.com/3/image`;

console.assert(argv['_'].length === 1);
const targetURL = argv['_'][0];
const noReplaceImage = argv['n'] || ('replace' in argv);
const _method = argv['host'];

cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.cloud_api_key,
    api_secret: process.env.cloud_api_secret,
});

(async () => {
    let content;
    let res;

    // source from telegra.ph generally needs special handling
    if (targetURL.match('telegra.ph')) {
        res = await Mercury.parse(targetURL);
        content = parseTelegrah(res.content);
    } else {
        res = await Mercury.parse(targetURL, { contentType: 'markdown' });
        content= res.content;
    }

    let titleString = `# ${res.title}\n`;
    let sourceString = `[来源](${res.url})\n`;

    content =  titleString + sourceString + content;
    // Generate AST
    let tree = remark().parse(content);
    const filename = await formatFileName(tree);
    remove(tree, 'html');

    // upload images to the-other-side of the wall
    console.log(`Replace images: ${!noReplaceImage}`);
    if (!noReplaceImage) {
        await replaceImage(tree, _method);
    }




    const finalMDString = remark().stringify(tree);
    const file = remark().processSync(finalMDString);

    fs.writeFile(`./${filename}.md`, file, err => {
        if (err) {
            return console.log(err);
        }

        console.log(`${filename}.md saved`);
    })

})();


const formatFileName = (tree) => new Promise((resolve, reject) => {
    let filename;
    try {
        visitor(tree, 'heading', node =>{
            if (node.depth !== 1) {
                return;
            }
            visitor(node, 'text', _sub => {
                let { value } = _sub;

                filename = value
                    .replace(/\u200B/g,'')
                    .trim()
                    .replace(/[.,，。、：丨？\|\/#!?$%\^&\*;:{}=\-_`~()\t\n]/g," ")
                    .trim()
                    .split(' ')
                    .join('-');

                resolve(filename)
            })
        });
    } catch (e) {
        reject(e);
    }
} );

const replaceImage = async (tree, method='cloudinary', free=true) => {
    let d = 0;
    let interval = 1000;
    const uploadPromises = [];
    visitor(tree, 'image', node => {
        uploadPromises.push(delayedUpload(node, d, method, free));
        d += interval;
    });

    await Promise.all(uploadPromises);
};

const delay = ms => new Promise(r => setTimeout(r, ms));

const delayedUpload = async (node, d, method, free) => {
    await delay(d);
    const uploadMethod = methods[method];
    const link = await uploadMethod(node.url, free);

    console.log(`uploaded image to ${link}`);
    node.url = link;

};


const uploadToCloudinary = (url, _) => {
    return new Promise((resolve, reject) => cloudinary.v2.uploader.upload(url, (err, res) => {
        if (err) {
            return reject(err);
        }

        return resolve(res.secure_url);
    }));
};

const uploadToImgur = async (url, free=true) => {
    try {
        let uploadURL,
            headers = {
                'Content-Type': 'application/json',
                Authorization: `Client-ID ${process.env.client_id}`,
            };

        if (free) {
            uploadURL = freeImgurUpLoadURL;
        } else {
            uploadURL = imgurUploadURL;
            headers = {
                ...headers,
                "x-rapidapi-host": "imgur-apiv3.p.rapidapi.com",
                "x-rapidapi-key": process.env.rapidapi_key,
            }
        }

        const res = await axios.post(uploadURL, {
            image: url,
        }, {
            headers,
        });

        return res.data.data.link;

    } catch (err) {
        console.log(err);
    }
};

const methods = {
    imgur: uploadToImgur,
    cloudinary: uploadToCloudinary,
};

const parseTelegrah = (htmlContent) => {
    // get rid of duplicate <strong />
    let duplicateStrongOpen = /\<strong\>[ \t]*\<strong\>/;
    let duplicateStrongClose = /\<\/strong\>[ \t]*\<\/strong\>/;
    let unnecessaryClosingStrong = /\<\/strong\>[ \t]*\<strong\>/;
    let unexpectedLineChangeAfterStrongOpen = /\<strong\>[ \t]*\<br\>/;
    let unexpectedLineChangeBeforeStrongClosing = /\<br\>[ \t]*\<\/strong\>/;

    // console.log(htmlContent);

    const regexStrings = [
        // duplicateStrongOpen,
        // duplicateStrongClose,
        unnecessaryClosingStrong,
        unexpectedLineChangeAfterStrongOpen,
        unexpectedLineChangeBeforeStrongClosing
    ];
    const replaceString = [
        // '<strong>',
        // '</strong>',
        '',
        '<br><strong>',
        '</strong><br>'
    ];

    regexStrings.forEach((re, i) => {
        while (htmlContent.match(re)) {
            htmlContent = htmlContent.replace(re, replaceString[i])
        }
    });

    // force image out of strong tag
    let imageStrongRegex = /\<strong\>[ \t]*\<img[^\>]*\>/;
    while (htmlContent.match(imageStrongRegex)) {
        htmlContent = htmlContent.replace(imageStrongRegex, ( match ) => {
            let imgTag = match.match(/\<img[^\>]*\>/)[0];
            return `${imgTag}<strong>`;
        })
    }

    // force image into separate paragraph
    let imageRegex = /\<img[^\>]*\>/g;
    htmlContent = htmlContent.replace(imageRegex, ( match ) => `<p>${match}</p>`);

    let mdString = unified()
        .use(parseHTML)
        .use(HTMLToMarkdown)
        .use(stringifyMarkdown)
        .processSync(htmlContent);
    return mdString.toString();
};
