d3.alluvialGrowth = function() {
  var alluvialGrowth = {},
      nodeWidth = 20,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [],
      sortBySize = true,
      relaxAlluvial = false;

  alluvialGrowth.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return alluvialGrowth;
  };

  alluvialGrowth.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return alluvialGrowth;
  };

  alluvialGrowth.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return alluvialGrowth;
  };

  alluvialGrowth.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return alluvialGrowth;
  };

  alluvialGrowth.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return alluvialGrowth;
  };

  alluvialGrowth.sortBySize = function() {
    if(!arguments.length) return sortBySize;
    
    sortBySize = _;
    return alluvialGrowth;
  };

  alluvialGrowth.relaxAlluvial = function() {
    if(!arguments.length) return relaxAlluvial;
    
    relaxAlluvial = _;
    return alluvialGrowth;
  };

  alluvialGrowth.layout = function(iterations) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations);
    computeLinkDepths();
    return alluvialGrowth;
  };

  alluvialGrowth.relayout = function() {
    computeLinkDepths();
    return alluvialGrowth;
  };
  
  alluvialGrowth.link = function() {
    var curvature = .5;

    function link(d) {

      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = d3.interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy,
          ytr = d.target.y + d.ety,
          ybr = ytr + (d.edy ? d.edy : 1),
          ybl = y0 + (d.dy ? d.dy : 1);
     console.log(d.dy);
      return "M" + x0 + "," + y0  //top left corner
           + "C" + x2 + "," + y0  //top left curve
           + " " + x3 + "," + ytr //top right curve
           + " " + x1 + "," + ytr //Top right corner
           + "L" + x1 + "," + ybr //bottom right corner
           + "C" + x3 + "," + ybr //bottom right curve
           + " " + x2 + "," + ybl //bottom left curve
           + " " + x0 + "," + ybl //bottom left corner
           + "L" + x0 + "," + (y0);
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {

      node.value = Math.max(d3.sum(node.sourceLinks, value),
                            d3.sum(node.targetLinks, endValue));
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          if (nextNodes.indexOf(link.target) < 0) {
            nextNodes.push(link.target);
          }
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }

    //
    moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  function moveSourcesRight() {
    nodes.forEach(function(node) {
      if (!node.targetLinks.length) {
        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
      }
    });
  }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function computeNodeDepths(iterations) {
    var nodesByBreadth = d3.nest()
        .key(function(d) { return d.x; })
        .sortKeys(d3.ascending)
        .entries(nodes)
        .map(function(d) { return d.values; });

    initializeNodeDepth();
    resolveCollisions();
    if(relaxAlluvial){
      for (var alpha = 1; iterations > 0; --iterations) {
        relaxRightToLeft(alpha *= .99);
        resolveCollisions();
        relaxLeftToRight(alpha);
        resolveCollisions();
      }
    }

    function orderByValueProperty(a, b) {
      return b.value - a.value;
    }
    
    function initializeNodeDepth() {
      var ky = d3.min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        if(sortBySize){
          nodes.sort(orderByValueProperty)
        }
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        if(typeof link.endValue === "undefined"){
          link.edy = link.value * ky;
        } else {
          link.edy = link.endValue * ky; //added this in to calculate the ending dy
        }
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes, breadth) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }

    function resolveCollisions() {
      nodesByBreadth.forEach(function(nodes) {
        var node,
            dy,
            y0 = 0,
            n = nodes.length,
            i;

        // Push any overlapping nodes down.
        nodes.sort(ascendingDepth);
        for (i = 0; i < n; ++i) {
          node = nodes[i];
          dy = y0 - node.y;
          if (dy > 0) node.y += dy;
          y0 = node.y + node.dy + nodePadding;
        }

        // If the bottommost node goes outside the bounds, push it back up.
        dy = y0 - nodePadding - size[1];
        if (dy > 0) {
          y0 = node.y -= dy;

          // Push any overlapping nodes back up.
          for (i = n - 2; i >= 0; --i) {
            node = nodes[i];
            dy = node.y + node.dy + nodePadding - y0;
            if (dy > 0) node.y -= dy;
            y0 = node.y;
          }
        }
      });
    }

    function ascendingDepth(a, b) {
      return a.y - b.y;
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0, ety = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ety = ety;
        ety += link.edy;

        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return a.source.y - b.source.y;
    }

    function ascendingTargetDepth(a, b) {
      return a.target.y - b.target.y;
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  function endValue(link) {
    return link.endValue;
  }

  return alluvialGrowth;
};

function drawSankeyChart(chartId, width, mapping){
	var labelPadding = 6,
		rightTextWidth = width * 0.3333,
		linkWidth = width - rightTextWidth - (2 * labelPadding),
		// Scale height based on the number of nodes we have, up to a limit
		height = Math.min(24 * mapping.nodes.length, 600),
		verticalPadding = 10,
		opacityLow = 0.02,
		opacityDefault = 0.3,
		exporting = chartId.indexOf('_export') > -1,
		tooltip;

	if(!exporting){
		$('#sankey_tooltip').remove(); // Prevents multiple tooltips from appearing when chart is redrawn
	}

	// make sure target is empty before adding svg
	var target = d3.select('#' + chartId);
	target.html('');

	var svg = target.append('svg')
		.attr('class', 'sankey')
		.attr('width', width)
		.attr('height', height + 2*verticalPadding)
		.append('g')
		.attr('transform', '');

	var sankey = d3.sankey()
		.nodeWidth(20)
		.nodePadding(10)
		.size([linkWidth, height - verticalPadding * 2]);

	if(!exporting){
		tooltip = d3.select('body')
			.append('div')
			.attr('id', 'sankey_tooltip')
			.attr('class', 'd3-hover-popover');
	}

  sankey(mapping);

  var alluvialGrowth = d3.alluvialGrowth()
    .nodeWidth(20)
    .nodePadding(10)
    .size([linkWidth, height]);

  var path = alluvialGrowth.link();
  
  alluvialGrowth
     .nodes(mapping.nodes)
     .links(mapping.links)
     .layout(32);

	var link = svg.append('g').selectAll('.link')
		.data(mapping.links)
		.enter().append('path')
		.attr('class', 'link')
		.attr('d', path)
		.style('fill', function(d){
			return d.color || 'black';
		})
		.sort(function(a, b){
			return b.width - a.width;
		})
		.on('mouseover', function(d){
			tooltip.text(d.source.name + ':\n' + d.source.value.toLocaleString() + ' postings → ' + d.target.value.toLocaleString() + ' postings');
			tooltip.style('visibility', 'visible');
			fadeNonHoveredLinks(d);
		})
		.on('mouseout', function(d){
			fadeInLinks(opacityDefault, d.name);
			return tooltip.style('visibility', 'hidden');
		})
		.on('mousemove', function(){
			return tooltip
				.style('top', (d3.event.pageY - 10) + 'px')
				.style('left', (d3.event.pageX + 10) + 'px');
		});

	var node = svg.append('g').selectAll('.node')
		.data(mapping.nodes)
		.enter().append('g')
		.attr('class', 'node')
		.attr('transform', function(d){
			return 'translate(' + d.x + ',' + d.y + ')';
		})
		.on('mouseover', function(d){
			fadeGroup(opacityLow, d.name);
		})
		.on('mouseout', function(d){
			fadeGroup(opacityDefault, d.name);
		});

	node.append('rect')
		.attr('height', function(d){
			return Math.max(1, d.dy);
		})
		.attr('width', alluvialGrowth.nodeWidth())
		.style('fill', function(d){ return d.color; })
		.on('mouseover', function(d){
			tooltip.text(d.name + ': ' + d.value.toLocaleString() + ' postings')
        .style('visibility', 'visible');
		})
		.on('mouseout', function(d){
			return tooltip.style('visibility', 'hidden');
		})
		.on('mousemove', function(){
			return tooltip
				.style('top', (d3.event.pageY - 10) + 'px')
				.style('left', (d3.event.pageX + 10) + 'px');
		});

	// if data node has sourceLinks, it's a left-hand side label
	var text = node.append('text')
		.attr('x', function(d){
			return labelPadding + alluvialGrowth.nodeWidth();
		})
		.attr('y', function(d){
			return d.dy / 2;
		})
		.attr('dy', '.4em') // this is hard-coded to look right for our current font
		.attr('text-anchor', function(d){
			return 'start';
		})
		.on('mouseover', function(d){
			tooltip.text(d.name + ': ' + d.value.toLocaleString() + ' postings')
        .style('visibility', 'visible');
			fadeGroup(opacityLow, d.name);
		})
		.on('mouseout', function(d){
			fadeGroup(opacityDefault, d.name);
			return tooltip.style('visibility', 'hidden');
		})
		.on('mousemove', function(){
			return tooltip
				.style('top', (d3.event.pageY - 10) + 'px')
				.style('left', (d3.event.pageX + 10) + 'px');
		});

	text.append('tspan')
		.text(function(d){
			return d.sourceLinks.length ? d.name : '';
		})
		.attr('width', function(d){
			var width = rightTextWidth;
			if(d.sourceLinks.length){
				width = linkWidth - (2 * labelPadding) - (2 * alluvialGrowth.nodeWidth());
			}
			return width;
		})
		.each(wrap);

	// http://stackoverflow.com/questions/9241315/trimming-text-to-a-given-pixel-width-in-svg
	function wrap(){
		var self = d3.select(this),
			textLength = self.node().getComputedTextLength(),
			text = self.text();

		while((textLength > self.attr('width')) && text.length > 0){
			text = text.slice(0, -1);
			self.text(text + '...');
			textLength = self.node().getComputedTextLength();
		}
	}

	// Fade groups of links
	function fadeGroup(opacity, name){
		svg.selectAll('path.link')
			.filter(function(d){
				return name != d.source.name && name != d.target.name;
			})
			.transition()
			.style('opacity', opacity);
	}

	// Return links to original opacity
	function fadeInLinks(opacity, name){
		svg.selectAll('path.link')
			.filter(function(d){
				return name != d.source.name || name != d.target.name;
			})
			.transition()
			.style('opacity', opacity);
	}

	// Keep chosen link the default opacity, fade the rest
	function fadeNonHoveredLinks(chosen){
		svg.selectAll('path.link')
			.transition()
			.style('opacity', function(d){
				return d.source.name === chosen.source.name && d.target.name === chosen.target.name ? opacityDefault : opacityLow;
			});
	}
}

let mapping = {"nodes":[{"name":"Truck Drivers","color":"#5178A7","id":0},{"name":"Truck Drivers","color":"#5178A7","id":1},{"name":"Truck Drivers","color":"#5178A7","id":2},{"name":"Commercial Driver's License (CDL) Drivers","color":"#EE8D32","id":3},{"name":"Commercial Driver's License (CDL) Drivers","color":"#EE8D32","id":4},{"name":"Commercial Driver's License (CDL) Drivers","color":"#EE8D32","id":5},{"name":"Customer Service Representatives","color":"#DD5459","id":6},{"name":"Customer Service Representatives","color":"#DD5459","id":7},{"name":"Customer Service Representatives","color":"#DD5459","id":8},{"name":"Sales Managers","color":"#7AB8B2","id":9},{"name":"Sales Managers","color":"#7AB8B2","id":10},{"name":"Sales Managers","color":"#7AB8B2","id":11},{"name":"Retail Sales Associates","color":"#AE78A1","id":12},{"name":"Retail Sales Associates","color":"#AE78A1","id":13},{"name":"Retail Sales Associates","color":"#AE78A1","id":14},{"name":"Registered Nurses","color":"#5CA353","id":15},{"name":"Registered Nurses","color":"#5CA353","id":16},{"name":"Registered Nurses","color":"#5CA353","id":17},{"name":"Owner Operators","color":"#EBCA52","id":18},{"name":"Owner Operators","color":"#EBCA52","id":19},{"name":"Owner Operators","color":"#EBCA52","id":20},{"name":"Sales Representatives","color":"#FC9BA7","id":21},{"name":"Sales Representatives","color":"#FC9BA7","id":22},{"name":"Sales Representatives","color":"#FC9BA7","id":23},{"name":"Over the Road (OTR) Drivers","color":"#9A7560","id":24},{"name":"Over the Road (OTR) Drivers","color":"#9A7560","id":25},{"name":"Over the Road (OTR) Drivers","color":"#9A7560","id":26},{"name":"Regional Truck Drivers","color":"#9BC9E4","id":27},{"name":"Regional Truck Drivers","color":"#9BC9E4","id":28},{"name":"Regional Truck Drivers","color":"#9BC9E4","id":29},{"name":"Restaurant Managers","color":"#BAB0AC","id":30},{"name":"Restaurant Managers","color":"#BAB0AC","id":31},{"name":"Restaurant Managers","color":"#BAB0AC","id":32},{"name":"Customer Service Associates","color":"#E6F669","id":33},{"name":"Customer Service Associates","color":"#E6F669","id":34},{"name":"Customer Service Associates","color":"#E6F669","id":35},{"name":"Software Engineers","color":"#7B1616","id":36},{"name":"Software Engineers","color":"#7B1616","id":37},{"name":"Software Engineers","color":"#7B1616","id":38},{"name":"Flatbed Drivers","color":"#2C3B1B","id":39},{"name":"Flatbed Drivers","color":"#2C3B1B","id":40},{"name":"Flatbed Drivers","color":"#2C3B1B","id":41},{"name":"Restaurant Crew Team Members","color":"#6E0087","id":42},{"name":"Restaurant Crew Team Members","color":"#6E0087","id":43},{"name":"Restaurant Crew Team Members","color":"#6E0087","id":44}],"links":[{"source":0,"target":1,"value":33810,"color":"#5178A7","endValue":60937},{"source":1,"target":2,"value":60937,"color":"#5178A7","endValue":43592},{"source":3,"target":4,"value":18994,"color":"#EE8D32","endValue":41170},{"source":4,"target":5,"value":41170,"color":"#EE8D32","endValue":32042},{"source":6,"target":7,"value":14996,"color":"#DD5459","endValue":17969},{"source":7,"target":8,"value":17969,"color":"#DD5459","endValue":14733},{"source":9,"target":10,"value":13104,"color":"#7AB8B2","endValue":17898},{"source":10,"target":11,"value":17898,"color":"#7AB8B2","endValue":15199},{"source":12,"target":13,"value":12150,"color":"#AE78A1","endValue":17403},{"source":13,"target":14,"value":17403,"color":"#AE78A1","endValue":13581},{"source":15,"target":16,"value":7048,"color":"#5CA353","endValue":9897},{"source":16,"target":17,"value":9897,"color":"#5CA353","endValue":19628},{"source":18,"target":19,"value":8737,"color":"#EBCA52","endValue":17432},{"source":19,"target":20,"value":17432,"color":"#EBCA52","endValue":9522},{"source":21,"target":22,"value":7857,"color":"#FC9BA7","endValue":11380},{"source":22,"target":23,"value":11380,"color":"#FC9BA7","endValue":8866},{"source":24,"target":25,"value":4515,"color":"#9A7560","endValue":13286},{"source":25,"target":26,"value":13286,"color":"#9A7560","endValue":8022},{"source":27,"target":28,"value":6751,"color":"#9BC9E4","endValue":10711},{"source":28,"target":29,"value":10711,"color":"#9BC9E4","endValue":7662},{"source":30,"target":31,"value":6387,"color":"#BAB0AC","endValue":8314},{"source":31,"target":32,"value":8314,"color":"#BAB0AC","endValue":7409},{"source":33,"target":34,"value":5223,"color":"#E6F669","endValue":7489},{"source":34,"target":35,"value":7489,"color":"#E6F669","endValue":5550},{"source":36,"target":37,"value":4730,"color":"#7B1616","endValue":7413},{"source":37,"target":38,"value":7413,"color":"#7B1616","endValue":4854},{"source":39,"target":40,"value":3354,"color":"#2C3B1B","endValue":8364},{"source":40,"target":41,"value":8364,"color":"#2C3B1B","endValue":4820},{"source":42,"target":43,"value":5110,"color":"#6E0087","endValue":0},{"source":43,"target":44,"value":0,"color":"#6E0087","endValue":0}]};


drawSankeyChart('target', 1000, mapping)