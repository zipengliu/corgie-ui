import React from "react";
import { render } from "react-dom";
import "./index.css";
import { Provider } from "react-redux";
import { applyMiddleware, createStore } from "redux";
import { BrowserRouter as Router, Switch, Route, useParams } from "react-router-dom";

import rootReducer from "./reducers";
import App from "./components/App";
import DatasetList from "./components/DatasetList";
import Upload from "./components/Upload";
import * as serviceWorker from "./serviceWorker";
import thunk from "redux-thunk";
import createLogger from "redux-logger";

console.log("Starting application...");

const store = createStore(rootReducer, applyMiddleware(thunk, createLogger));

render(
    <Provider store={store}>
        <Router>
            <Switch>
                <Route path="/upload">
                    <Upload />
                </Route>
                <Route path="/:datasetId">
                    <App />
                </Route>
                <Route path="/">
                    <DatasetList />
                </Route>
            </Switch>
        </Router>
    </Provider>,
    document.getElementById("root")
);

// ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.register();
