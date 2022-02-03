# Visualizing Graph Neural Networks with CorGIE: Corresponding a Graph to its Embedding

CorGIE is a visualization tool for graph neural networks.  This repo hosts the frontend code of CorGIE, and [the other repo](https://github.com/zipengliu/corgie-preprocess-server) hosts the backend code.

## Demo

[http://corgie.site](http://corgie.site)

You can upload your own datasets [here](http://corgie.site/#/upload).

## Installation

You need [nodejs](https://nodejs.org/en/download/) (version>=14.0) and the package management tool (either [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)) to run our code locally.

To install dependencies, run `yarn install` or `npm install` in the project root directory.

To start the application, run `yarn start` or `npm start`.  You will be able to open the page with the URL `http://localhost:3000` on your browser.

Note: this would serve the data files locally from `public/data/` statically, so you would not be able to use the upload page.  To upload your own dataset, you need to install the [backend](https://github.com/zipengliu/corgie-preprocess-server) or use our [demo website](http://corgie.site).



## Paper

Zipeng Liu, Yang Wang, Jürgen Bernard, Tamara Munzner.  Visualizing Graph Neural Networks with CorGIE: Corresponding a Graph to Its Embedding.  TVCG 2022.

[arxiv link](https://arxiv.org/abs/2106.12839)



