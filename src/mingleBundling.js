const KdTree = (function () {
    /**
     * k-d Tree JavaScript - V 1.0
     *
     * https://github.com/ubilabs/kd-tree-javascript
     *
     * @author Mircea Pricop <pricop@ubilabs.net>, 2012
     * @author Martin Kleppe <kleppe@ubilabs.net>, 2012
     * @author Ubilabs http://ubilabs.net, 2012
     * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
     */

    function Node(obj, dimension, parent) {
        this.obj = obj;
        this.left = null;
        this.right = null;
        this.parent = parent;
        this.dimension = dimension;
    }

    function kdTree(points, metric, dimensions) {
        var self = this;

        function buildTree(points, depth, parent) {
            var dim = depth % dimensions.length,
                median,
                node;

            if (points.length === 0) {
                return null;
            }
            if (points.length === 1) {
                return new Node(points[0], dim, parent);
            }

            points.sort(function (a, b) {
                return a[dimensions[dim]] - b[dimensions[dim]];
            });

            median = Math.floor(points.length / 2);
            node = new Node(points[median], dim, parent);
            node.left = buildTree(points.slice(0, median), depth + 1, node);
            node.right = buildTree(points.slice(median + 1), depth + 1, node);

            return node;
        }

        // Reloads a serialied tree
        function loadTree(data) {
            // Just need to restore the `parent` parameter
            self.root = data;

            function restoreParent(root) {
                if (root.left) {
                    root.left.parent = root;
                    restoreParent(root.left);
                }

                if (root.right) {
                    root.right.parent = root;
                    restoreParent(root.right);
                }
            }

            restoreParent(self.root);
        }

        // If points is not an array, assume we're loading a pre-built tree
        if (!Array.isArray(points)) loadTree(points, metric, dimensions);
        else this.root = buildTree(points, 0, null);

        // Convert to a JSON serializable structure; this just requires removing
        // the `parent` property
        this.toJSON = function (src) {
            if (!src) src = this.root;
            var dest = new Node(src.obj, src.dimension, null);
            if (src.left) dest.left = self.toJSON(src.left);
            if (src.right) dest.right = self.toJSON(src.right);
            return dest;
        };

        this.insert = function (point) {
            function innerSearch(node, parent) {
                if (node === null) {
                    return parent;
                }

                var dimension = dimensions[node.dimension];
                if (point[dimension] < node.obj[dimension]) {
                    return innerSearch(node.left, node);
                } else {
                    return innerSearch(node.right, node);
                }
            }

            var insertPosition = innerSearch(this.root, null),
                newNode,
                dimension;

            if (insertPosition === null) {
                this.root = new Node(point, 0, null);
                return;
            }

            newNode = new Node(point, (insertPosition.dimension + 1) % dimensions.length, insertPosition);
            dimension = dimensions[insertPosition.dimension];

            if (point[dimension] < insertPosition.obj[dimension]) {
                insertPosition.left = newNode;
            } else {
                insertPosition.right = newNode;
            }
        };

        this.remove = function (point) {
            var node;

            function nodeSearch(node) {
                if (node === null) {
                    return null;
                }

                if (node.obj === point) {
                    return node;
                }

                var dimension = dimensions[node.dimension];

                if (point[dimension] < node.obj[dimension]) {
                    return nodeSearch(node.left, node);
                } else {
                    return nodeSearch(node.right, node);
                }
            }

            function removeNode(node) {
                var nextNode, nextObj, pDimension;

                function findMax(node, dim) {
                    var dimension, own, left, right, max;

                    if (node === null) {
                        return null;
                    }

                    dimension = dimensions[dim];
                    if (node.dimension === dim) {
                        if (node.right !== null) {
                            return findMax(node.right, dim);
                        }
                        return node;
                    }

                    own = node.obj[dimension];
                    left = findMax(node.left, dim);
                    right = findMax(node.right, dim);
                    max = node;

                    if (left !== null && left.obj[dimension] > own) {
                        max = left;
                    }

                    if (right !== null && right.obj[dimension] > max.obj[dimension]) {
                        max = right;
                    }
                    return max;
                }

                function findMin(node, dim) {
                    var dimension, own, left, right, min;

                    if (node === null) {
                        return null;
                    }

                    dimension = dimensions[dim];

                    if (node.dimension === dim) {
                        if (node.left !== null) {
                            return findMin(node.left, dim);
                        }
                        return node;
                    }

                    own = node.obj[dimension];
                    left = findMin(node.left, dim);
                    right = findMin(node.right, dim);
                    min = node;

                    if (left !== null && left.obj[dimension] < own) {
                        min = left;
                    }
                    if (right !== null && right.obj[dimension] < min.obj[dimension]) {
                        min = right;
                    }
                    return min;
                }

                if (node.left === null && node.right === null) {
                    if (node.parent === null) {
                        self.root = null;
                        return;
                    }

                    pDimension = dimensions[node.parent.dimension];

                    if (node.obj[pDimension] < node.parent.obj[pDimension]) {
                        node.parent.left = null;
                    } else {
                        node.parent.right = null;
                    }
                    return;
                }

                if (node.left !== null) {
                    nextNode = findMax(node.left, node.dimension);
                } else {
                    nextNode = findMin(node.right, node.dimension);
                }

                nextObj = nextNode.obj;
                removeNode(nextNode);
                node.obj = nextObj;
            }

            node = nodeSearch(self.root);

            if (node === null) {
                return;
            }

            removeNode(node);
        };

        this.nearest = function (point, maxNodes, maxDistance) {
            var i, result, bestNodes;

            bestNodes = new BinaryHeap(function (e) {
                return -e[1];
            });

            function nearestSearch(node) {
                var bestChild,
                    dimension = dimensions[node.dimension],
                    ownDistance = metric(point, node.obj),
                    linearPoint = {},
                    linearDistance,
                    otherChild,
                    i;

                function saveNode(node, distance) {
                    bestNodes.push([node, distance]);
                    if (bestNodes.size() > maxNodes) {
                        bestNodes.pop();
                    }
                }

                for (i = 0; i < dimensions.length; i += 1) {
                    if (i === node.dimension) {
                        linearPoint[dimensions[i]] = point[dimensions[i]];
                    } else {
                        linearPoint[dimensions[i]] = node.obj[dimensions[i]];
                    }
                }

                linearDistance = metric(linearPoint, node.obj);

                if (node.right === null && node.left === null) {
                    if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
                        saveNode(node, ownDistance);
                    }
                    return;
                }

                if (node.right === null) {
                    bestChild = node.left;
                } else if (node.left === null) {
                    bestChild = node.right;
                } else {
                    if (point[dimension] < node.obj[dimension]) {
                        bestChild = node.left;
                    } else {
                        bestChild = node.right;
                    }
                }

                nearestSearch(bestChild);

                if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
                    saveNode(node, ownDistance);
                }

                if (bestNodes.size() < maxNodes || Math.abs(linearDistance) < bestNodes.peek()[1]) {
                    if (bestChild === node.left) {
                        otherChild = node.right;
                    } else {
                        otherChild = node.left;
                    }
                    if (otherChild !== null) {
                        nearestSearch(otherChild);
                    }
                }
            }

            if (maxDistance) {
                for (i = 0; i < maxNodes; i += 1) {
                    bestNodes.push([null, maxDistance]);
                }
            }

            nearestSearch(self.root);

            result = [];

            for (i = 0; i < maxNodes; i += 1) {
                if (bestNodes.content[i]) {
                    result.push([bestNodes.content[i][0].obj, bestNodes.content[i][1]]);
                }
            }
            return result;
        };

        this.balanceFactor = function () {
            function height(node) {
                if (node === null) {
                    return 0;
                }
                return Math.max(height(node.left), height(node.right)) + 1;
            }

            function count(node) {
                if (node === null) {
                    return 0;
                }
                return count(node.left) + count(node.right) + 1;
            }

            return height(self.root) / (Math.log(count(self.root)) / Math.log(2));
        };
    }

    // Binary heap implementation from:
    // http://eloquentjavascript.net/appendix2.html

    function BinaryHeap(scoreFunction) {
        this.content = [];
        this.scoreFunction = scoreFunction;
    }

    BinaryHeap.prototype = {
        push: function (element) {
            // Add the new element to the end of the array.
            this.content.push(element);
            // Allow it to bubble up.
            this.bubbleUp(this.content.length - 1);
        },

        pop: function () {
            // Store the first element so we can return it later.
            var result = this.content[0];
            // Get the element at the end of the array.
            var end = this.content.pop();
            // If there are any elements left, put the end element at the
            // start, and let it sink down.
            if (this.content.length > 0) {
                this.content[0] = end;
                this.sinkDown(0);
            }
            return result;
        },

        peek: function () {
            return this.content[0];
        },

        remove: function (node) {
            var len = this.content.length;
            // To remove a value, we must search through the array to find
            // it.
            for (var i = 0; i < len; i++) {
                if (this.content[i] == node) {
                    // When it is found, the process seen in 'pop' is repeated
                    // to fill up the hole.
                    var end = this.content.pop();
                    if (i != len - 1) {
                        this.content[i] = end;
                        if (this.scoreFunction(end) < this.scoreFunction(node)) this.bubbleUp(i);
                        else this.sinkDown(i);
                    }
                    return;
                }
            }
            throw new Error("Node not found.");
        },

        size: function () {
            return this.content.length;
        },

        bubbleUp: function (n) {
            // Fetch the element that has to be moved.
            var element = this.content[n];
            // When at 0, an element can not go up any further.
            while (n > 0) {
                // Compute the parent element's index, and fetch it.
                var parentN = Math.floor((n + 1) / 2) - 1,
                    parent = this.content[parentN];
                // Swap the elements if the parent is greater.
                if (this.scoreFunction(element) < this.scoreFunction(parent)) {
                    this.content[parentN] = element;
                    this.content[n] = parent;
                    // Update 'n' to continue at the new position.
                    n = parentN;
                }
                // Found a parent that is less, no need to move it further.
                else {
                    break;
                }
            }
        },

        sinkDown: function (n) {
            // Look up the target element and its score.
            var length = this.content.length,
                element = this.content[n],
                elemScore = this.scoreFunction(element);

            while (true) {
                // Compute the indices of the child elements.
                var child2N = (n + 1) * 2,
                    child1N = child2N - 1;
                // This is used to store the new position of the element,
                // if any.
                var swap = null;
                // If the first child exists (is inside the array)...
                if (child1N < length) {
                    // Look it up and compute its score.
                    var child1 = this.content[child1N],
                        child1Score = this.scoreFunction(child1);
                    // If the score is less than our element's, we need to swap.
                    if (child1Score < elemScore) swap = child1N;
                }
                // Do the same checks for the other child.
                if (child2N < length) {
                    var child2 = this.content[child2N],
                        child2Score = this.scoreFunction(child2);
                    if (child2Score < (swap == null ? elemScore : child1Score)) {
                        swap = child2N;
                    }
                }

                // If the element needs to be moved, swap it, and continue.
                if (swap != null) {
                    this.content[n] = this.content[swap];
                    this.content[swap] = element;
                    n = swap;
                }
                // Otherwise, we are done.
                else {
                    break;
                }
            }
        },
    };

    return kdTree;
})();

const Graph = (function () {
    function descriptor(object) {
        var desc = {},
            p;
        for (p in object) {
            desc[p] = {
                value: object[p],
                writable: true,
                enumerable: true,
                configurable: true,
            };
        }
        return desc;
    }

    function merge(proto, object) {
        return Object.create(proto, descriptor(object));
    }

    function extend(proto, object) {
        var p;
        for (p in object) {
            proto[p] = object[p];
        }
    }
    /*
     * File: Graph.js
     *
     */

    /*
     Class: Graph
     A Graph Class that provides useful manipulation functions. You can find more manipulation methods in the <Graph.Util> object.
     An instance of this class can be accessed by using the *graph* parameter of any tree or graph visualization.
     Example:
     (start code js)
       //create new visualization
       var viz = new $jit.Viz(options);
       //load JSON data
       viz.loadJSON(json);
       //access model
       viz.graph; //<Graph> instance
     (end code)
     Implements:
     The following <Graph.Util> methods are implemented in <Graph>
      - <Graph.Util.getNode>
      - <Graph.Util.eachNode>
      - <Graph.Util.computeLevels>
      - <Graph.Util.eachBFS>
      - <Graph.Util.clean>
      - <Graph.Util.getClosestNodeToPos>
      - <Graph.Util.getClosestNodeToOrigin>
    */

    var Graph = function (opt) {
        this.opt = merge(
            {
                node: {},
            },
            opt || {}
        );
        this.nodes = {};
        this.edges = {};
    };

    Graph.fromJSON = function (json) {
        var nodes = json.nodes,
            edges = json.edges,
            Node = Graph.Node,
            Edge = Graph.Edge,
            graph = new Graph(),
            k;

        for (k in nodes) {
            nodes[k] = Node.fromJSON(nodes[k]);
        }

        graph.nodes = nodes;

        for (k in edges) {
            edges[k] = Edge.fromJSON(graph, edges[k]);
        }

        graph.edges = edges;

        return graph;
    };

    Graph.prototype = {
        clear: function () {
            this.nodes = {};
            this.edges = {};
        },

        //serialize
        toJSON: function () {
            var nodes = [],
                edges = [],
                gNodes = this.nodes,
                gEdges = this.edges,
                k,
                from,
                to;

            for (k in gNodes) {
                nodes.push(gNodes[k].toJSON());
            }

            for (from in gEdges) {
                for (to in gEdges[from]) {
                    edges.push(gEdges[from][to].toJSON());
                }
            }

            return { nodes: nodes, edges: edges };
        },

        /*
         Method: getNode
         Returns a <Graph.Node> by *id*.
         Parameters:
         id - (string) A <Graph.Node> id.
         Example:
         (start code js)
           var node = graph.getNode('nodeId');
         (end code)
    */
        getNode: function (id) {
            if (this.hasNode(id)) return this.nodes[id];
            return false;
        },

        /*
         Method: get
         An alias for <Graph.Util.getNode>. Returns a node by *id*.
         Parameters:
         id - (string) A <Graph.Node> id.
         Example:
         (start code js)
           var node = graph.get('nodeId');
         (end code)
    */
        get: function (id) {
            return this.getNode(id);
        },

        /*
       Method: getByName
       Returns a <Graph.Node> by *name*.
       Parameters:
       name - (string) A <Graph.Node> name.
       Example:
       (start code js)
         var node = graph.getByName('someName');
       (end code)
      */
        getByName: function (name) {
            for (var id in this.nodes) {
                var n = this.nodes[id];
                if (n.name == name) return n;
            }
            return false;
        },

        /*
       Method: getEdge
       Returns a <Graph.Edge> object connecting nodes with ids *id* and *id2*.
       Parameters:
       id - (string) A <Graph.Node> id.
       id2 - (string) A <Graph.Node> id.
    */
        getEdge: function (id, id2) {
            if (id in this.edges) {
                return this.edges[id][id2];
            }
            return false;
        },

        /*
         Method: addNode
         Adds a node.
         Parameters:
          obj - An object with the properties described below
          id - (string) A node id
          name - (string) A node's name
          data - (object) A node's data hash
        See also:
        <Graph.Node>
      */
        addNode: function (obj) {
            if (!this.nodes[obj.id]) {
                var edges = (this.edges[obj.id] = {});
                this.nodes[obj.id] = new Graph.Node(
                    merge(
                        {
                            id: obj.id,
                            name: obj.name,
                            data: merge(obj.data || {}, {}),
                            adjacencies: edges,
                        },
                        this.opt.node
                    )
                );
            }
            return this.nodes[obj.id];
        },

        /*
         Method: addEdge
         Connects nodes specified by *obj* and *obj2*. If not found, nodes are created.
         Parameters:
          obj - (object) A <Graph.Node> object.
          obj2 - (object) Another <Graph.Node> object.
          data - (object) A data object. Used to store some extra information in the <Graph.Edge> object created.
        See also:
        <Graph.Node>, <Graph.Edge>
        */
        addEdge: function (obj, obj2, data) {
            if (!this.hasNode(obj.id)) {
                this.addNode(obj);
            }
            if (!this.hasNode(obj2.id)) {
                this.addNode(obj2);
            }
            obj = this.nodes[obj.id];
            obj2 = this.nodes[obj2.id];
            if (!obj.adjacentTo(obj2)) {
                var adjsObj = (this.edges[obj.id] = this.edges[obj.id] || {});
                var adjsObj2 = (this.edges[obj2.id] = this.edges[obj2.id] || {});
                adjsObj[obj2.id] = adjsObj2[obj.id] = new Graph.Edge(obj, obj2, data, this.Edge, this.Label);
                return adjsObj[obj2.id];
            }
            return this.edges[obj.id][obj2.id];
        },

        /*
         Method: removeNode
         Removes a <Graph.Node> matching the specified *id*.
         Parameters:
         id - (string) A node's id.
        */
        removeNode: function (id) {
            if (this.hasNode(id)) {
                delete this.nodes[id];
                var adjs = this.edges[id];
                for (var to in adjs) {
                    delete this.edges[to][id];
                }
                delete this.edges[id];
            }
        },

        /*
         Method: removeEdge
         Removes a <Graph.Edge> matching *id1* and *id2*.
         Parameters:
         id1 - (string) A <Graph.Node> id.
         id2 - (string) A <Graph.Node> id.
    */
        removeEdge: function (id1, id2) {
            delete this.edges[id1][id2];
            delete this.edges[id2][id1];
        },

        /*
         Method: hasNode
         Returns a boolean indicating if the node belongs to the <Graph> or not.
         Parameters:
            id - (string) Node id.
       */
        hasNode: function (id) {
            return id in this.nodes;
        },

        /*
        Method: empty
        Empties the Graph
      */
        empty: function () {
            this.nodes = {};
            this.edges = {};
        },
    };

    /*
         Class: Graph.Node
         A <Graph> node.
         Implements:
         <Accessors> methods.
         The following <Graph.Util> methods are implemented by <Graph.Node>
        - <Graph.Util.eachEdge>
        - <Graph.Util.eachLevel>
        - <Graph.Util.eachSubgraph>
        - <Graph.Util.eachSubnode>
        - <Graph.Util.anySubnode>
        - <Graph.Util.getSubnodes>
        - <Graph.Util.getParents>
        - <Graph.Util.isDescendantOf>
    */
    Graph.Node = function (opt) {
        var innerOptions = {
            id: "",
            name: "",
            data: {},
            adjacencies: {},
        };
        extend(this, merge(innerOptions, opt));
    };

    Graph.Node.fromJSON = function (json) {
        return new Graph.Node(json);
    };

    Graph.Node.prototype = {
        toJSON: function () {
            return {
                id: this.id,
                name: this.name,
                data: this.serializeData(this.data),
            };
        },

        serializeData: function (data) {
            var serializedData = {},
                parents = data.parents,
                parentsCopy,
                i,
                l;

            if (parents) {
                parentsCopy = Array(parents.length);
                for (i = 0, l = parents.length; i < l; ++i) {
                    parentsCopy[i] = parents[i].toJSON();
                }
            }

            for (i in data) {
                serializedData[i] = data[i];
            }

            delete serializedData.parents;
            delete serializedData.bundle;
            serializedData = JSON.parse(JSON.stringify(serializedData));

            if (parentsCopy) {
                serializedData.parents = parentsCopy;
            }

            return serializedData;
        },

        /*
           Method: adjacentTo
           Indicates if the node is adjacent to the node specified by id
           Parameters:
              id - (string) A node id.
           Example:
           (start code js)
            node.adjacentTo('nodeId') == true;
           (end code)
        */
        adjacentTo: function (node) {
            return node.id in this.adjacencies;
        },

        /*
           Method: getAdjacency
           Returns a <Graph.Edge> object connecting the current <Graph.Node> and the node having *id* as id.
           Parameters:
              id - (string) A node id.
        */
        getEdge: function (id) {
            return this.adjacencies[id];
        },

        /*
           Method: toString
           Returns a String with information on the Node.
        */
        toString: function () {
            return "Node(" + JSON.stringify([this.id, this.name, this.data, this.adjacencies]) + ")";
        },
    };

    /*
         Class: Graph.Edge
         A <Graph> adjacence (or edge) connecting two <Graph.Nodes>.
         Implements:
         <Accessors> methods.
         See also:
         <Graph>, <Graph.Node>
         Properties:
          nodeFrom - A <Graph.Node> connected by this edge.
          nodeTo - Another  <Graph.Node> connected by this edge.
          data - Node data property containing a hash (i.e {}) with custom options.
    */
    Graph.Edge = function (nodeFrom, nodeTo, data) {
        this.nodeFrom = nodeFrom;
        this.nodeTo = nodeTo;
        this.data = data || {};
    };

    Graph.Edge.fromJSON = function (graph, edgeJSON) {
        return new Graph.Edge(graph.get(edgeJSON.nodeFrom), graph.get(edgeJSON.nodeTo), edgeJSON.data);
    };

    Graph.Edge.prototype.toJSON = function () {
        return {
            nodeFrom: this.nodeFrom.id,
            nodeTo: this.nodeTo.id,
            data: this.data,
        };
    };

    /*
       Object: Graph.Util
       <Graph> traversal and processing utility object.
       Note:
       For your convenience some of these methods have also been appended to <Graph> and <Graph.Node> classes.
    */
    Graph.Util = {
        /*
           filter
           For internal use only. Provides a filtering function based on flags.
        */
        filter: function (param) {
            if (!param || !(typeof param == "string"))
                return function () {
                    return true;
                };
            var props = param.split(" ");
            return function (elem) {
                for (var i = 0; i < props.length; i++) {
                    if (elem[props[i]]) {
                        return false;
                    }
                }
                return true;
            };
        },
        /*
           Method: getNode
           Returns a <Graph.Node> by *id*.
           Also implemented by:
           <Graph>
           Parameters:
           graph - (object) A <Graph> instance.
           id - (string) A <Graph.Node> id.
           Example:
           (start code js)
             $jit.Graph.Util.getNode(graph, 'nodeid');
             //or...
             graph.getNode('nodeid');
           (end code)
        */
        getNode: function (graph, id) {
            return graph.nodes[id];
        },

        /*
           Method: eachNode
           Iterates over <Graph> nodes performing an *action*.
           Also implemented by:
           <Graph>.
           Parameters:
           graph - (object) A <Graph> instance.
           action - (function) A callback function having a <Graph.Node> as first formal parameter.
           Example:
           (start code js)
             $jit.Graph.Util.eachNode(graph, function(node) {
              alert(node.name);
             });
             //or...
             graph.eachNode(function(node) {
               alert(node.name);
             });
           (end code)
        */
        eachNode: function (graph, action, flags) {
            var filter = this.filter(flags);
            for (var i in graph.nodes) {
                if (filter(graph.nodes[i])) action(graph.nodes[i]);
            }
        },

        /*
          Method: each
          Iterates over <Graph> nodes performing an *action*. It's an alias for <Graph.Util.eachNode>.
          Also implemented by:
          <Graph>.
          Parameters:
          graph - (object) A <Graph> instance.
          action - (function) A callback function having a <Graph.Node> as first formal parameter.
          Example:
          (start code js)
            $jit.Graph.Util.each(graph, function(node) {
             alert(node.name);
            });
            //or...
            graph.each(function(node) {
              alert(node.name);
            });
          (end code)
       */
        each: function (graph, action, flags) {
            this.eachNode(graph, action, flags);
        },

        /*
           Method: eachEdge
           Iterates over <Graph.Node> adjacencies applying the *action* function.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           action - (function) A callback function having <Graph.Edge> as first formal parameter.
           Example:
           (start code js)
             $jit.Graph.Util.eachEdge(node, function(adj) {
              alert(adj.nodeTo.name);
             });
             //or...
             node.eachEdge(function(adj) {
               alert(adj.nodeTo.name);
             });
           (end code)
        */
        eachEdge: function (node, action, flags) {
            var adj = node.adjacencies,
                filter = this.filter(flags);
            for (var id in adj) {
                var a = adj[id];
                if (filter(a)) {
                    if (a.nodeFrom != node) {
                        var tmp = a.nodeFrom;
                        a.nodeFrom = a.nodeTo;
                        a.nodeTo = tmp;
                    }
                    action(a, id);
                }
            }
        },

        /*
           Method: computeLevels
           Performs a BFS traversal setting the correct depth for each node.
           Also implemented by:
           <Graph>.
           Note:
           The depth of each node can then be accessed by
           >node.depth
           Parameters:
           graph - (object) A <Graph>.
           id - (string) A starting node id for the BFS traversal.
           startDepth - (optional|number) A minimum depth value. Default's 0.
        */
        computeLevels: function (graph, id, startDepth, flags) {
            startDepth = startDepth || 0;
            var filter = this.filter(flags);
            this.eachNode(
                graph,
                function (elem) {
                    elem._flag = false;
                    elem.depth = -1;
                },
                flags
            );
            var root = graph.getNode(id);
            root.depth = startDepth;
            var queue = [root];
            while (queue.length != 0) {
                var node = queue.pop();
                node._flag = true;
                this.eachEdge(
                    node,
                    function (adj) {
                        var n = adj.nodeTo;
                        if (n._flag == false && filter(n) && !adj._hiding) {
                            if (n.depth < 0) n.depth = node.depth + 1 + startDepth;
                            queue.unshift(n);
                        }
                    },
                    flags
                );
            }
        },

        /*
           Method: eachBFS
           Performs a BFS traversal applying *action* to each <Graph.Node>.
           Also implemented by:
           <Graph>.
           Parameters:
           graph - (object) A <Graph>.
           id - (string) A starting node id for the BFS traversal.
           action - (function) A callback function having a <Graph.Node> as first formal parameter.
           Example:
           (start code js)
             $jit.Graph.Util.eachBFS(graph, 'mynodeid', function(node) {
              alert(node.name);
             });
             //or...
             graph.eachBFS('mynodeid', function(node) {
               alert(node.name);
             });
           (end code)
        */
        eachBFS: function (graph, id, action, flags) {
            var filter = this.filter(flags);
            this.clean(graph);
            var queue = [graph.getNode(id)];
            while (queue.length != 0) {
                var node = queue.pop();
                if (!node) return;
                node._flag = true;
                action(node, node.depth);
                this.eachEdge(
                    node,
                    function (adj) {
                        var n = adj.nodeTo;
                        if (n._flag == false && filter(n) && !adj._hiding) {
                            n._flag = true;
                            queue.unshift(n);
                        }
                    },
                    flags
                );
            }
        },

        /*
           Method: eachLevel
           Iterates over a node's subgraph applying *action* to the nodes of relative depth between *levelBegin* and *levelEnd*.
           In case you need to break the iteration, *action* should return false.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           levelBegin - (number) A relative level value.
           levelEnd - (number) A relative level value.
           action - (function) A callback function having a <Graph.Node> as first formal parameter.
        */
        eachLevel: function (node, levelBegin, levelEnd, action, flags) {
            var d = node.depth,
                filter = this.filter(flags),
                that = this,
                shouldContinue = true;
            levelEnd = levelEnd === false ? Number.MAX_VALUE - d : levelEnd;
            (function loopLevel(node, levelBegin, levelEnd) {
                if (!shouldContinue) return;
                var d = node.depth,
                    ret;
                if (d >= levelBegin && d <= levelEnd && filter(node)) ret = action(node, d);
                if (typeof ret !== "undefined") shouldContinue = ret;
                if (shouldContinue && d < levelEnd) {
                    that.eachEdge(node, function (adj) {
                        var n = adj.nodeTo;
                        if (n.depth > d) loopLevel(n, levelBegin, levelEnd);
                    });
                }
            })(node, levelBegin + d, levelEnd + d);
        },

        /*
           Method: eachSubgraph
           Iterates over a node's children recursively.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           action - (function) A callback function having a <Graph.Node> as first formal parameter.
           Example:
           (start code js)
             $jit.Graph.Util.eachSubgraph(node, function(node) {
               alert(node.name);
             });
             //or...
             node.eachSubgraph(function(node) {
               alert(node.name);
             });
           (end code)
        */
        eachSubgraph: function (node, action, flags) {
            this.eachLevel(node, 0, false, action, flags);
        },

        /*
           Method: eachSubnode
           Iterates over a node's children (without deeper recursion).
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           action - (function) A callback function having a <Graph.Node> as first formal parameter.
           Example:
           (start code js)
             $jit.Graph.Util.eachSubnode(node, function(node) {
              alert(node.name);
             });
             //or...
             node.eachSubnode(function(node) {
               alert(node.name);
             });
           (end code)
        */
        eachSubnode: function (node, action, flags) {
            this.eachLevel(node, 1, 1, action, flags);
        },

        /*
           Method: anySubnode
           Returns *true* if any subnode matches the given condition.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           cond - (function) A callback function returning a Boolean instance. This function has as first formal parameter a <Graph.Node>.
           Example:
           (start code js)
             $jit.Graph.Util.anySubnode(node, function(node) { return node.name == "mynodename"; });
             //or...
             node.anySubnode(function(node) { return node.name == 'mynodename'; });
           (end code)
        */
        anySubnode: function (node, cond, flags) {
            var flag = false;
            cond =
                cond ||
                function () {
                    return true;
                };
            var c =
                typeof cond == "string"
                    ? function (n) {
                          return n[cond];
                      }
                    : cond;
            this.eachSubnode(
                node,
                function (elem) {
                    if (c(elem)) flag = true;
                },
                flags
            );
            return flag;
        },

        /*
           Method: getSubnodes
           Collects all subnodes for a specified node.
           The *level* parameter filters nodes having relative depth of *level* from the root node.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           level - (optional|number) Default's *0*. A starting relative depth for collecting nodes.
           Returns:
           An array of nodes.
        */
        getSubnodes: function (node, level, flags) {
            var ans = [],
                that = this;
            level = level || 0;
            var levelStart, levelEnd;
            if (Array.isArray(level) == "array") {
                levelStart = level[0];
                levelEnd = level[1];
            } else {
                levelStart = level;
                levelEnd = Number.MAX_VALUE - node.depth;
            }
            this.eachLevel(
                node,
                levelStart,
                levelEnd,
                function (n) {
                    ans.push(n);
                },
                flags
            );
            return ans;
        },

        /*
           Method: getParents
           Returns an Array of <Graph.Nodes> which are parents of the given node.
           Also implemented by:
           <Graph.Node>.
           Parameters:
           node - (object) A <Graph.Node>.
           Returns:
           An Array of <Graph.Nodes>.
           Example:
           (start code js)
             var pars = $jit.Graph.Util.getParents(node);
             //or...
             var pars = node.getParents();
             if(pars.length > 0) {
               //do stuff with parents
             }
           (end code)
        */
        getParents: function (node) {
            var ans = [];
            this.eachEdge(node, function (adj) {
                var n = adj.nodeTo;
                if (n.depth < node.depth) ans.push(n);
            });
            return ans;
        },

        /*
        Method: isDescendantOf
        Returns a boolean indicating if some node is descendant of the node with the given id.
        Also implemented by:
        <Graph.Node>.
        Parameters:
        node - (object) A <Graph.Node>.
        id - (string) A <Graph.Node> id.
        Example:
        (start code js)
          $jit.Graph.Util.isDescendantOf(node, "nodeid"); //true|false
          //or...
          node.isDescendantOf('nodeid');//true|false
        (end code)
     */
        isDescendantOf: function (node, id) {
            if (node.id == id) return true;
            var pars = this.getParents(node),
                ans = false;
            for (var i = 0; !ans && i < pars.length; i++) {
                ans = ans || this.isDescendantOf(pars[i], id);
            }
            return ans;
        },

        /*
         Method: clean
         Cleans flags from nodes.
         Also implemented by:
         <Graph>.
         Parameters:
         graph - A <Graph> instance.
      */
        clean: function (graph) {
            this.eachNode(graph, function (elem) {
                elem._flag = false;
            });
        },
    };

    //Append graph methods to <Graph>
    ["get", "getNode", "each", "eachNode", "computeLevels", "eachBFS", "clean"].forEach(function (m) {
        Graph.prototype[m] = function () {
            return Graph.Util[m].apply(Graph.Util, [this].concat(Array.prototype.slice.call(arguments)));
        };
    });

    //Append node methods to <Graph.Node>
    [
        "eachEdge",
        "eachLevel",
        "eachSubgraph",
        "eachSubnode",
        "anySubnode",
        "getSubnodes",
        "getParents",
        "isDescendantOf",
    ].forEach(function (m) {
        Graph.Node.prototype[m] = function () {
            return Graph.Util[m].apply(Graph.Util, [this].concat(Array.prototype.slice.call(arguments)));
        };
    });

    return Graph;
})();

module.exports = (function () {
    //General convenience functions and constants
    Math.PHI = (1 + Math.sqrt(5)) / 2;

    function $dist(a, b) {
        var diffX = a[0] - b[0],
            diffY = a[1] - b[1];
        return Math.sqrt(diffX * diffX + diffY * diffY);
    }

    function $norm(a) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
    }

    function $normalize(a) {
        var n = $norm(a);
        return $mult(1 / n, a);
    }

    function $lerp(a, b, delta) {
        return [a[0] * (1 - delta) + b[0] * delta, a[1] * (1 - delta) + b[1] * delta];
    }

    function $add(a, b) {
        return [a[0] + b[0], a[1] + b[1]];
    }

    function $sub(a, b) {
        return [a[0] - b[0], a[1] - b[1]];
    }

    function $dot(a, b) {
        return a[0] * b[0] + a[1] * b[1];
    }

    function $mult(k, a) {
        return [a[0] * k, a[1] * k];
    }

    function $lerpPoint(from, to, delta) {
        return [$lerp(from[0], to[0], delta), $lerp(from[1], to[1], delta)];
    }

    function cloneJSON(json) {
        return JSON.parse(JSON.stringify(json));
    }

    function cloneEdge(json) {
        var i,
            l = json.length,
            ans = Array(json.length);
        for (i = 0; i < l; ++i) {
            ans[i] = {
                node: json[i].node,
                pos: json[i].pos,
                normal: json[i].normal && json[i].normal.slice(),
            };
        }
        return ans;
    }

    //Extend generic Graph class with bundle methods and rendering options
    function expandEdgesHelper(node, array, collect) {
        var coords = node.data.coords,
            i,
            l,
            p,
            ps;

        if (!array.length) {
            array.push([(coords[0] + coords[2]) / 2, (coords[1] + coords[3]) / 2]);
        }

        array.unshift([coords[0], coords[1]]);
        array.push([coords[2], coords[3]]);
        ps = node.data.parents;
        if (ps) {
            for (i = 0, l = ps.length; i < l; ++i) {
                expandEdgesHelper(ps[i], array.slice(), collect);
            }
        } else {
            collect.push(array);
        }
    }

    function setNormalVector(nodeFrom, nodeTo) {
        var node = nodeFrom || nodeTo,
            dir,
            coords,
            normal;
        if (!nodeFrom || !nodeTo) {
            coords = node.data.coords;
            dir = [coords[2] - coords[0], coords[3] - coords[1]];
            normal = [-dir[1], dir[0]];
            normal = $mult(normal, 1 / $norm(normal));
        }
        return normal;
    }

    function createPosItem(node, pos, index, total) {
        return {
            node: node, //.toJSON(),
            pos: pos,
            normal: null,
        };
    }

    //Extend generic Graph class with bundle methods and rendering options
    function expandEdgesRichHelper(node, array, collect) {
        var coords = node.data.coords,
            i,
            l,
            p,
            ps,
            a,
            posItem;
        ps = node.data.parents;
        if (ps) {
            for (i = 0, l = ps.length; i < l; ++i) {
                a = array.slice();
                if (!a.length) {
                    p = [(coords[0] + coords[2]) / 2, (coords[1] + coords[3]) / 2];
                    posItem = createPosItem(node, p, i, l);
                    a.push(posItem);
                }

                posItem = createPosItem(node, [coords[0], coords[1]], i, l);
                a.unshift(posItem);
                posItem = createPosItem(node, [coords[2], coords[3]], i, l);
                a.push(posItem);

                expandEdgesRichHelper(ps[i], a, collect);
            }
        } else {
            a = array.slice();
            if (!a.length) {
                p = [(coords[0] + coords[2]) / 2, (coords[1] + coords[3]) / 2];
                posItem = createPosItem(node, p, 0, 1);
                a.push(posItem);
            }

            posItem = createPosItem(node, [coords[0], coords[1]], 0, 1);
            a.unshift(posItem);
            posItem = createPosItem(node, [coords[2], coords[3]], 0, 1);
            a.push(posItem);

            collect.push(a);
        }
    }

    Graph.Node.prototype.expandEdges = function () {
        if (this.expandedEdges) {
            return this.expandedEdges;
        }
        var ans = [];
        expandEdgesRichHelper(this, [], ans);
        this.expandedEdges = ans;
        return ans;
    };

    Graph.Node.prototype.unbundleEdges = function (delta) {
        var expandedEdges = this.expandEdges(),
            ans = Array(expandedEdges.length),
            min = Math.min,
            i,
            l,
            j,
            n,
            edge,
            edgeCopy,
            normal,
            x0,
            xk,
            xk_x0,
            xi,
            xi_x0,
            xi_bar,
            dot,
            norm,
            norm2,
            c,
            last;

        delta = delta || 0;
        this.unbundledEdges = this.unbundledEdges || {};

        if ((delta === 0 || delta === 1) && this.unbundledEdges[delta]) {
            return this.unbundledEdges[delta];
        }

        for (i = 0, l = expandedEdges.length; i < l; ++i) {
            edge = expandedEdges[i];
            last = edge.length - 1;
            edgeCopy = cloneEdge(edge);
            //edgeCopy = cloneJSON(edge);
            x0 = edge[0].pos;
            xk = edge[last].pos;
            xk_x0 = $sub(xk, x0);

            edgeCopy[0].unbundledPos = edgeCopy[0].pos.slice();
            normal = $sub(edgeCopy[1].pos, edgeCopy[0].pos);
            normal = $normalize([-normal[1], normal[0]]);
            edgeCopy[0].normal = normal;

            edgeCopy[last].unbundledPos = edgeCopy[edge.length - 1].pos.slice();
            normal = $sub(edgeCopy[last].pos, edgeCopy[last - 1].pos);
            normal = $normalize([-normal[1], normal[0]]);
            edgeCopy[last].normal = normal;

            for (j = 1, n = edge.length - 1; j < n; ++j) {
                xi = edge[j].pos;
                xi_x0 = $sub(xi, x0);
                dot = $dot(xi_x0, xk_x0);
                norm = $dist(xk, x0);
                norm2 = norm * norm;
                c = dot / norm2;
                xi_bar = $add(x0, $mult(c, xk_x0));
                edgeCopy[j].unbundledPos = $lerp(xi_bar, xi, delta);
                normal = $sub(edgeCopy[j + 1].pos, edgeCopy[j - 1].pos);
                normal = $normalize([-normal[1], normal[0]]);
                edgeCopy[j].normal = normal;
            }
            ans[i] = edgeCopy;
        }

        if (delta === 0 || delta === 1) {
            this.unbundledEdges[delta] = ans;
        }

        return ans;
    };

    Graph.Render = {
        renderLine: function (ctx, edges, options) {
            options = options || {};
            var lineWidth = options.lineWidth || 1,
                fillStyle = options.fillStyle || "gray",
                i,
                l,
                j,
                n,
                e,
                pos;

            ctx.fillStyle = fillStyle;
            ctx.lineWidth = lineWidth;
            for (i = 0, l = edges.length; i < l; ++i) {
                e = edges[i];
                ctx.beginPath();
                for (j = 0, n = e.length; j < n; ++j) {
                    pos = e[j].unbundledPos;
                    if (j == 0) {
                        ctx.moveTo(pos[0], pos[1]);
                    } else {
                        ctx.lineTo(pos[0], pos[1]);
                    }
                }
                ctx.stroke();
                ctx.closePath();
            }
        },

        renderQuadratic: function (ctx, edges, options) {
            options = options || {};
            var lineWidth = options.lineWidth || 1,
                fillStyle = options.fillStyle || "gray",
                margin = (options.margin || 0) * (options.delta || 0),
                lengthBefore,
                lengthAfter,
                index,
                i,
                l,
                j,
                k,
                n,
                e,
                node,
                pos,
                pos0,
                pos1,
                pos2,
                pos3,
                pos01,
                pos02,
                pos03,
                pos04,
                colorFrom,
                colorTo,
                grd,
                midPos,
                quadStart,
                weightStart,
                posStart,
                nodeStart,
                posItem,
                posItemStart,
                dist,
                distMin,
                nodeArray,
                nodeLength;

            ctx.fillStyle = fillStyle;
            ctx.lineWidth = lineWidth;

            for (i = 0, l = edges.length; i < l; ++i) {
                e = edges[i];
                quadStart = null;
                posStart = null;
                nodeStart = e[0].node;
                ctx.lineWidth = (Math.max(1, nodeStart.data.weight) || 1) * (options.scale || 1);
                if (nodeStart.data.color && Array.isArray(nodeStart.data.color)) {
                    colorFrom = nodeStart.data.color[0];
                    colorTo = nodeStart.data.color[1];
                    grd = ctx.createLinearGradient(
                        nodeStart.data.coords[0],
                        nodeStart.data.coords[1],
                        nodeStart.data.coords[2],
                        nodeStart.data.coords[3]
                    );
                    grd.addColorStop(0, colorFrom);
                    grd.addColorStop(0.4, colorFrom);
                    grd.addColorStop(0.6, colorTo);
                    grd.addColorStop(1, colorTo);
                    ctx.strokeStyle = grd;
                } else {
                    ctx.strokeStyle = nodeStart.data.color || ctx.strokeStyle;
                }
                ctx.globalAlpha = nodeStart.data.alpha == undefined ? 1 : nodeStart.data.alpha;
                ctx.beginPath();
                for (j = 0, n = e.length; j < n; ++j) {
                    posItem = e[j];
                    pos = posItem.unbundledPos;
                    if (j !== 0) {
                        pos0 = posStart || e[j - 1].unbundledPos;
                        pos = this.adjustPosition(nodeStart.id, posItem, pos, margin, options.delta || 0);
                        midPos = $lerp(pos0, pos, 0.5);
                        pos1 = $lerp(pos0, midPos, j === 1 ? 0 : options.curviness || 0);
                        pos3 = pos;
                        pos2 = $lerp(midPos, pos3, j === n - 1 ? 1 : 1 - (options.curviness || 0));
                        //ctx.lineCap = 'butt';//'round';
                        //ctx.beginPath();
                        if (quadStart) {
                            //ctx.strokeStyle = 'black';
                            ctx.moveTo(quadStart[0], quadStart[1]);
                            ctx.quadraticCurveTo(pos0[0], pos0[1], pos1[0], pos1[1]);
                            //ctx.stroke();
                            //ctx.closePath();
                        }
                        //ctx.beginPath();
                        //ctx.strokeStyle = 'red';
                        ctx.moveTo(pos1[0], pos1[1]);
                        ctx.lineTo(pos2[0], pos2[1]);
                        //ctx.stroke();
                        //ctx.closePath();
                        quadStart = pos2;
                        posStart = pos;
                    }
                }
                ctx.stroke();
                ctx.closePath();
            }
        },

        adjustPosition: function (id, posItem, pos, margin, delta) {
            var nodeArray = posItem.node.data.nodeArray,
                epsilon = 1,
                nodeLength,
                index,
                lengthBefore,
                lengthAfter,
                k,
                node;

            if (nodeArray) {
                nodeLength = nodeArray.length;
                index = Infinity;
                lengthBefore = 0;
                lengthAfter = 0;
                for (k = 0; k < nodeLength; ++k) {
                    node = nodeArray[k];
                    if (node.id == id) {
                        index = k;
                    }
                    if (k < index) {
                        lengthBefore += (node.data.weight || 0) + margin;
                    } else if (k > index) {
                        lengthAfter += (node.data.weight || 0) + margin;
                    }
                }
                //remove -margin to get the line weight into account.
                //pos = $add(pos, $mult((lengthBefore - (lengthBefore + lengthAfter) / 2) * -margin, posItem.normal));
                pos = $add(
                    pos,
                    $mult(
                        (lengthBefore - (lengthBefore + lengthAfter) / 2) * Math.min(epsilon, delta),
                        posItem.normal
                    )
                );
            }

            return pos;
        },

        renderBezier: function (ctx, edges, options) {
            options = options || {};
            var pct = options.curviness || 0,
                i,
                l,
                j,
                n,
                e,
                pos,
                midpoint,
                c1,
                c2,
                start,
                end;

            for (i = 0, l = edges.length; i < l; ++i) {
                e = edges[i];
                start = e[0].unbundledPos;
                ctx.strokeStyle = e[0].node.data.color || ctx.strokeStyle;
                ctx.lineWidth = e[0].node.data.weight || 1;
                midpoint = e[(e.length - 1) / 2].unbundledPos;
                if (e.length > 3) {
                    c1 = e[1].unbundledPos;
                    c2 = e[(e.length - 1) / 2 - 1].unbundledPos;
                    end = $lerp(midpoint, c2, 1 - pct);
                    ctx.beginPath();
                    ctx.moveTo(start[0], start[1]);
                    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
                    c1 = e[(e.length - 1) / 2 + 1].unbundledPos;
                    c2 = e[e.length - 2].unbundledPos;
                    end = e[e.length - 1].unbundledPos;
                    if (1 - pct) {
                        //line to midpoint + pct of something
                        start = $lerp(midpoint, c1, 1 - pct);
                        ctx.lineTo(start[0], start[1]);
                    }
                    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
                    ctx.stroke();
                    ctx.closePath();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(start[0], start[1]);
                    end = e[e.length - 1].unbundledPos;
                    ctx.lineTo(end[0], end[1]);
                }
            }
        },
    };

    //Edge bundling algorithm class.
    function Bundler(options) {
        this.options = options || {};
        this.graph = new Graph();
        this.kdTree = null;
    }

    //copy static methods to render lines and other from Graph
    Bundler.Graph = Graph.Render;

    Bundler.prototype = {
        setNodes: function (nodes) {
            var i,
                l,
                graph = this.graph;
            graph.clear();
            for (i = 0, l = nodes.length; i < l; ++i) {
                graph.addNode(nodes[i]);
            }
        },

        buildKdTree: function () {
            var nodeArray = [];
            this.graph.each(function (n) {
                var coords = n.data.coords;
                n.x = coords[0];
                n.y = coords[1];
                n.z = coords[2];
                n.w = coords[3];
                nodeArray.push(n);
            });

            this.kdTree = new KdTree(
                nodeArray,
                function (a, b) {
                    var diff0 = a.x - b.x,
                        diff1 = a.y - b.y,
                        diff2 = a.z - b.z,
                        diff3 = a.w - b.w;

                    return Math.sqrt(diff0 * diff0 + diff1 * diff1 + diff2 * diff2 + diff3 * diff3);
                },
                ["x", "y", "z", "w"]
            );
        },

        buildNearestNeighborGraph: function (k) {
            k = k || 10;
            var graph = this.graph,
                node,
                dist,
                kdTree;
            this.buildKdTree();
            kdTree = this.kdTree;
            graph.each(function (n) {
                var nodes = kdTree.nearest(n, k),
                    i,
                    l;
                for (i = 0, l = nodes.length; i < l; ++i) {
                    node = nodes[i][0];
                    dist = nodes[i][1];
                    if (node.id != n.id) {
                        graph.addEdge(n, node);
                    }
                }
            });
        },

        computeIntermediateNodePositions: function (node) {
            var m1, m2, centroids, a, b, c, tau, f, res;
            if (!node.data.nodes) {
                return;
            }
            centroids = this.getCentroids(node.data.nodes);
            f = this.costFunction.bind(this, node, centroids);
            a = 0;
            b = 1;
            c = 0.72; //because computers
            tau = 0.1;
            res = this.goldenSectionSearch(a, b, c, tau, f);
            f(res); //set m1 and m2;
        },

        costFunction: function (node, centroids, x) {
            var top, bottom, m1, m2, ink, alpha, p;
            x /= 2;
            top = centroids[0];
            bottom = centroids[1];
            m1 = $lerp(top, bottom, x);
            m2 = $lerp(top, bottom, 1 - x);
            node.data.m1 = m1;
            node.data.m2 = m2;
            delete node.data.ink;
            ink = this.getInkValue(node);
            alpha = this.getMaxTurningAngleValue(node, m1, m2);
            p = this.options.angleStrength || 1.2;
            return ink * (1 + Math.sin(alpha) / p);
        },

        goldenSectionSearch: function (a, b, c, tau, f) {
            var phi = Math.PHI,
                resphi = 2 - Math.PHI,
                abs = Math.abs,
                x;

            if (c - b > b - a) {
                x = b + resphi * (c - b);
            } else {
                x = b - resphi * (b - a);
            }
            if (abs(c - a) < tau * (abs(b) + abs(x))) {
                return (c + a) / 2;
            }
            if (f(x) < f(b)) {
                if (c - b > b - a) {
                    return this.goldenSectionSearch(b, x, c, tau, f);
                }
                return this.goldenSectionSearch(a, x, b, tau, f);
            }
            if (c - b > b - a) {
                return this.goldenSectionSearch(a, b, x, tau, f);
            }
            return this.goldenSectionSearch(x, b, c, tau, f);
        },

        getCentroids: function (nodes) {
            var topCentroid = [0, 0],
                bottomCentroid = [0, 0],
                coords,
                i,
                l;

            for (i = 0, l = nodes.length; i < l; ++i) {
                coords = nodes[i].data.coords;
                topCentroid[0] += coords[0];
                topCentroid[1] += coords[1];
                bottomCentroid[0] += coords[2];
                bottomCentroid[1] += coords[3];
            }

            topCentroid[0] /= l;
            topCentroid[1] /= l;
            bottomCentroid[0] /= l;
            bottomCentroid[1] /= l;

            return [topCentroid, bottomCentroid];
        },

        getInkValue: function (node, depth) {
            var data = node.data,
                sqrt = Math.sqrt,
                coords,
                diffX,
                diffY,
                m1,
                m2,
                acum,
                i,
                l,
                nodes,
                ni;

            depth = depth || 0;

            //bundled node
            if (!depth && (data.bundle || data.nodes)) {
                nodes = data.bundle ? data.bundle.data.nodes : data.nodes;
                m1 = data.m1;
                m2 = data.m2;
                acum = 0;
                for (i = 0, l = nodes.length; i < l; ++i) {
                    ni = nodes[i];
                    coords = ni.data.coords;
                    diffX = m1[0] - coords[0];
                    diffY = m1[1] - coords[1];
                    acum += $norm([diffX, diffY]);
                    diffX = m2[0] - coords[2];
                    diffY = m2[1] - coords[3];
                    acum += $norm([diffX, diffY]);
                    acum += this.getInkValue(ni, depth + 1);
                }
                if (!depth) {
                    acum += $dist(m1, m2);
                }
                return (node.data.ink = acum);
            }

            //coalesced node
            if (data.parents) {
                nodes = data.parents;
                m1 = [data.coords[0], data.coords[1]];
                m2 = [data.coords[2], data.coords[3]];
                acum = 0;
                for (i = 0, l = nodes.length; i < l; ++i) {
                    ni = nodes[i];
                    coords = ni.data.coords;
                    diffX = m1[0] - coords[0];
                    diffY = m1[1] - coords[1];
                    acum += $norm([diffX, diffY]);
                    diffX = m2[0] - coords[2];
                    diffY = m2[1] - coords[3];
                    acum += $norm([diffX, diffY]);
                    acum += this.getInkValue(ni, depth + 1);
                }
                //only add the distance if this is the first recursion
                if (!depth) {
                    acum += $dist(m1, m2);
                }
                return (node.data.ink = acum);
            }

            //simple node
            if (depth) {
                return (node.data.ink = 0);
            }
            coords = node.data.coords;
            diffX = coords[0] - coords[2];
            diffY = coords[1] - coords[3];
            return (node.data.ink = $norm([diffX, diffY]));
        },

        getMaxTurningAngleValue: function (node, m1, m2) {
            var sqrt = Math.sqrt,
                abs = Math.abs,
                acos = Math.acos,
                m2Tom1 = [m1[0] - m2[0], m1[1] - m2[1]],
                m1Tom2 = [-m2Tom1[0], -m2Tom1[1]],
                m1m2Norm = $norm(m2Tom1),
                angle = 0,
                nodes,
                vec,
                norm,
                dot,
                angleValue,
                x,
                y,
                coords,
                i,
                l,
                n;

            if (node.data.bundle || node.data.nodes) {
                nodes = node.data.bundle ? node.data.bundle.data.nodes : node.data.nodes;
                for (i = 0, l = nodes.length; i < l; ++i) {
                    coords = nodes[i].data.coords;
                    vec = [coords[0] - m1[0], coords[1] - m1[1]];
                    norm = $norm(vec);
                    dot = vec[0] * m2Tom1[0] + vec[1] * m2Tom1[1];
                    angleValue = abs(acos(dot / norm / m1m2Norm));
                    angle = angle < angleValue ? angleValue : angle;

                    vec = [coords[2] - m2[0], coords[3] - m2[1]];
                    norm = $norm(vec);
                    dot = vec[0] * m1Tom2[0] + vec[1] * m1Tom2[1];
                    angleValue = abs(acos(dot / norm / m1m2Norm));
                    angle = angle < angleValue ? angleValue : angle;
                }

                return angle;
            }

            return -1;
        },

        getCombinedNode: function (node1, node2, data) {
            node1 = node1.data.bundle || node1;
            node2 = node2.data.bundle || node2;

            var id = node1.id + "-" + node2.id,
                name = node1.name + "-" + node2.name,
                nodes1 = node1.data.nodes || [node1],
                nodes2 = node2.data.nodes || [node2],
                weight1 = node1.data.weight || 0,
                weight2 = node2.data.weight || 0,
                nodes = [],
                ans;

            if (node1.id == node2.id) {
                return node1;
            }
            nodes.push.apply(nodes, nodes1);
            nodes.push.apply(nodes, nodes2);
            data = data || {};
            data.nodes = nodes;
            data.nodeArray = (node1.data.nodeArray || []).concat(node2.data.nodeArray || []);
            data.weight = weight1 + weight2;
            ans = {
                id: id,
                name: name,
                data: data,
            };

            this.computeIntermediateNodePositions(ans);

            return ans;
        },

        coalesceNodes: function (nodes) {
            var node = nodes[0],
                data = node.data,
                m1 = data.m1,
                m2 = data.m2,
                weight = nodes.reduce(function (acum, n) {
                    return acum + (n.data.weight || 0);
                }, 0),
                coords = data.coords,
                bundle = data.bundle,
                nodeArray = [],
                i,
                l;

            if (m1) {
                coords = [m1[0], m1[1], m2[0], m2[1]];

                //flattened nodes for cluster.
                for (i = 0, l = nodes.length; i < l; ++i) {
                    nodeArray.push.apply(
                        nodeArray,
                        nodes[i].data.nodeArray || (nodes[i].data.parents ? [] : [nodes[i]])
                    );
                }

                if (this.options.sort) {
                    console.log(nodeArray);
                    nodeArray.sort(this.options.sort);
                }

                //if (!nodeArray.length || (typeof nodeArray[0].id == 'string')) {
                //debugger;
                //}

                return {
                    id: bundle.id,
                    name: bundle.id,
                    data: {
                        nodeArray: nodeArray,
                        parents: nodes,
                        coords: coords,
                        weight: weight,
                        parentsInk: bundle.data.ink,
                    },
                };
            }

            return nodes[0];
        },

        bundle: function (combinedNode, node1, node2) {
            var graph = this.graph;

            node1.data.bundle = combinedNode;
            node2.data.bundle = combinedNode;

            node1.data.ink = combinedNode.data.ink;
            node1.data.m1 = combinedNode.data.m1;
            node1.data.m2 = combinedNode.data.m2;
            //node1.data.nodeArray = combinedNode.data.nodeArray;

            node2.data.ink = combinedNode.data.ink;
            node2.data.m1 = combinedNode.data.m1;
            node2.data.m2 = combinedNode.data.m2;
            //node2.data.nodeArray = combinedNode.data.nodeArray;
        },

        updateGraph: function (graph, groupedNode, nodes, ids) {
            var i,
                l,
                n,
                connections,
                checkConnection = function (e) {
                    var nodeToId = e.nodeTo.id;
                    if (!ids[nodeToId]) {
                        connections.push(e.nodeTo);
                    }
                };
            for (i = 0, l = nodes.length; i < l; ++i) {
                n = nodes[i];
                connections = [];
                n.eachEdge(checkConnection);
                graph.removeNode(n.id);
            }
            graph.addNode(groupedNode);
            for (i = 0, l = connections.length; i < l; ++i) {
                graph.addEdge(groupedNode, connections[i]);
            }
        },

        coalesceGraph: function () {
            var graph = this.graph,
                newGraph = new Graph(),
                groupsIds = {},
                maxGroup = -Infinity,
                nodes,
                i,
                l,
                ids,
                groupedNode,
                connections,
                updateGraph = this.updateGraph,
                coalesceNodes = this.coalesceNodes.bind(this);

            graph.each(function (node) {
                var group = node.data.group;
                if (maxGroup < group) {
                    maxGroup = group;
                }
                if (!groupsIds[group]) {
                    groupsIds[group] = {};
                }
                groupsIds[group][node.id] = node;
            });

            maxGroup++;
            while (maxGroup--) {
                ids = groupsIds[maxGroup];
                nodes = [];
                for (i in ids) {
                    nodes.push(ids[i]);
                }
                if (nodes.length) {
                    groupedNode = coalesceNodes(nodes);
                    updateGraph(graph, groupedNode, nodes, ids);
                }
            }
        },

        getMaximumInkSavingNeighbor: function (n) {
            var nodeFrom = n,
                getInkValue = this.getInkValue.bind(this),
                inkFrom = getInkValue(nodeFrom),
                combineNodes = this.getCombinedNode.bind(this),
                inkTotal = Infinity,
                bundle = Array(2),
                combinedBundle;

            n.eachEdge(function (e) {
                var nodeTo = e.nodeTo,
                    inkTo = getInkValue(nodeTo),
                    combined = combineNodes(nodeFrom, nodeTo),
                    inkUnion = getInkValue(combined),
                    inkValue = inkUnion - (inkFrom + inkTo);

                if (inkTotal > inkValue) {
                    inkTotal = inkValue;
                    bundle[0] = nodeFrom;
                    bundle[1] = nodeTo;
                    combinedBundle = combined;
                }
            });

            return {
                bundle: bundle,
                inkTotal: inkTotal,
                combined: combinedBundle,
            };
        },

        MINGLE: function () {
            var edgeProximityGraph = this.graph,
                that = this,
                totalGain = 0,
                ungrouped = -1,
                gain = 0,
                k = 0,
                clean = function (n) {
                    n.data.group = ungrouped;
                },
                nodeMingle = function (node) {
                    if (node.data.group == ungrouped) {
                        var ans = that.getMaximumInkSavingNeighbor(node),
                            bundle = ans.bundle,
                            u = bundle[0],
                            v = bundle[1],
                            combined = ans.combined,
                            gainUV = -ans.inkTotal;

                        //graph has been collapsed and is now only one node
                        if (!u && !v) {
                            gain = -Infinity;
                            return;
                        }

                        if (gainUV > 0) {
                            that.bundle(combined, u, v);
                            gain += gainUV;
                            if (v.data.group != ungrouped) {
                                u.data.group = v.data.group;
                            } else {
                                u.data.group = v.data.group = k;
                            }
                        } else {
                            u.data.group = k;
                        }
                        k++;
                    }
                };

            do {
                gain = 0;
                k = 0;
                edgeProximityGraph.each(clean);
                edgeProximityGraph.each(nodeMingle);
                this.coalesceGraph();
                totalGain += gain;
            } while (gain > 0);
        },
    };

    // this.Bundler = Bundler;

    return Bundler;
})();
