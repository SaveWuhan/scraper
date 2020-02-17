News Coverage Scraping Scripts
--
Author: will

### Intro

This is a simple scraping scripts originally created for the other repository [SaveWuhan/NewsCoverageOnWuhan](https://github.com/SaveWuhan/NewsCoverageOnWuhan). The script turns distracting web view into clean, formatted Markdown `md` file.

### Requirement

`node` is required for running this scripts.

### Usage

1. `$ yarn add` or `$ npm install`
2. `$ node scrape url [options]`

### Notes and Options

By default, the script will upload images onto **cloudinary** to ensure each image would remain rendered in case of the deletion of original works.

*Ideally*, you would have and `.env` file with following entries specified 

```bash
# for imgur
export client_id=[your_imgur_client_id]

# for cloundiary
export cloud_name=[your_cloudinary_clound_name]
export cloud_api_key=[your_cloudinary_clound_api_key]
export cloud_api_secret=[your_cloudinary_clound_api_secret]
```

and `$ source .env` before running the scripts.

- **If you have no `imgur` or `cloudinary` credentials, `-n`, `--no-replace` flags can be used to prevent any image uploading.** However, if you do wish to contribute to [SaveWuhan/NewsCoverageOnWuhan](https://github.com/SaveWuhan/NewsCoverageOnWuhan), we would have to require each image uploaded to either hosting service that is accessible outside China.
	- example:  
	`$node scrape https://mp.weixin.qq.com/s/U4IrYQcPc6G-ce9X5eRE_g -n`

* You can specify image host service using `--host` flag. *Nonetheless, **cloudinary** is strongly recommended for its reliability and gracious rate limits.*
	- options: `cloudinary`, `imgur`
	- default: `cloudinary`
	- example
	`$node scrape https://mp.weixin.qq.com/s/U4IrYQcPc6G-ce9X5eRE_g --host=imgur`

