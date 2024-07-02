<script setup lang="ts">

import * as d3 from "d3";
import {computed, onMounted, ref, watch} from "vue";
import {useWindowSize} from 'vue-window-size';
import {Building} from "@/Building";

const props = defineProps<{
  buildingMap: Map<number, Building>
}>()

const building = [ ... props.buildingMap.values() ]
const maxConsumptionCount = building.reduce( (m, b) => Math.max( m, Object.keys( b.data.consumption ?? {} ).length ), 0 )

function setCanvasSize(width: number, height: number) {
  d3
      .select("svg")
      .attr("width", width)
      .attr("height", height)
}


const { width, height } = useWindowSize();
const wrapper = ref()

watch( [width, height], () => {
  //console.log( wrapper.value )
  setCanvasSize( wrapper.value.clientWidth, wrapper.value.clientHeight )
})

onMounted( () => {
  const r = 24 // line margin
  const width = wrapper.value.clientWidth
  const height = wrapper.value.clientHeight
  const markerBoxWidth = 12
  const markerBoxHeight = 6
  const arrowPoints = [[0, 0], [markerBoxWidth, markerBoxHeight/2], [0, markerBoxHeight]];
  const svg = d3
      .select("svg")
      .attr("width", width)
      .attr("height", height)
      .style("pointer-events", "all")
      .call(d3.zoom().on("zoom", function (e) {
        svg.attr("transform", e.transform)
      }) )

      .append("g")

  svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
      .attr('refX', markerBoxWidth - 3)
      .attr('refY', markerBoxHeight / 2)
      .attr('markerWidth', markerBoxWidth)
      .attr('markerHeight', markerBoxHeight)
      .attr('orient', 'auto-start-reverse')
      .append('path')
      .attr('d', d3.line()(arrowPoints))
      .attr('stroke', "none")
      .attr("stroke-linecap", "square")
      .attr("fill", "#aaa");

  ;

  // group also by cons - prods
  const groups = new Set< string >()
  const dataNodes = building.map( b => {

    //only for productive builds
    if ( b.data.consumption !== undefined || b.data.production !== undefined ) {
      const key = JSON.stringify( {
        consumption: Object.keys(b.data.consumption ?? {}),
        production: Object.keys(b.data.production ?? {})
      } )

      if (groups.has(key)) { // add to list
        console.debug( "paired building:", b )
        return
      }

      groups.add(key)
    }

    const weight = Object.keys( b.data.consumption ?? {} ).length
    return {
      id: b.id,
      name: b.id,
      b,
      x: weight * (width/maxConsumptionCount),
      y: height / 2
      //y: NaN
    }
  } ).filter( a => a !== undefined )

  const byProduction = new Map< string, Array<Building> >()
  const byConsumption = new Map< string, Array<Building> >()

  dataNodes.forEach( node => {
    const b = node.b
    Object.keys( b.data.consumption ?? [] ).forEach( c => {
      if ( !byConsumption.has( c ) ) {
        byConsumption.set( c, [] )
      }
      byConsumption.get( c ).push( b )
    })
    Object.keys( b.data.production ?? [] ).forEach( c => {
      if ( !byProduction.has( c ) ) {
        byProduction.set( c, [] )
      }
      byProduction.get( c ).push( b )
    })
  })

  const dataLinks = dataNodes.flatMap ( node => {
    const b = node.b
        return Object.keys(b.data.consumption ?? []).filter( a => a !== "vehicles" ).flatMap(c => {
          const prodb = byProduction.get(c)
          if ( prodb == undefined ) {
            //console.log( c )
            return []
          }
          return prodb.map(prodBy => ({
            id: `${b.id}-${prodBy.id}`,
            target: b.id,
            source: prodBy.id,
            product: c
          }))
        })
      }
  )

  // Initialize the links
  const linkWrap = svg
      .selectAll("g.link")
      .data(dataLinks)
      .enter()
      .append( "svg:g")
      .attr("class", "link")
  const link2 =  linkWrap.append("line")
      .style("stroke", "#aaa")
      .attr('marker-end', 'url(#arrow)')
  const link = d3.linkHorizontal().source( d => [ 0, 0 ]).target( d => [100, 100] )

  //     .x( d => {
  //       const lx = d.target.x - d.source.x;
  //       const ly = d.target.y - d.source.y;
  //       return d.source.x + r * lx / Math.sqrt( lx * lx + ly * ly );
  //     } )
  //     .y( d => {
  //
  //     })
  //.attr("pathLength", "50%")
  //
  // const linkLabel = linkWrap.append("text")
  //     .attr( "text-anchor", "middle")
  //     .text( d => d.product )
  const linkLabel = linkWrap

      .append( "image")
      .attr('x', -12)
      .attr('y', -12)
      .attr('width', 24)
      .attr('height', 24)
      .attr("xlink:href", d => `/src/assets/i/res/${d.product}.png`)

  // Initialize the nodes
  const node = svg
      .selectAll("g.node")
      .data(dataNodes)

  const nodeEnter = node.enter()
      .append("svg:g")
      .attr("class", "node")
      .call( d3.drag()
          .on("drag", (event, d) => {
            d.x = event.x
            d.y = event.y
          })
          .on("drag.update", (event, d ) => {
            if ( !started ) {
              simulation.alpha(0.1)
              simulation.restart()
            }
          } )
      );

  nodeEnter.append("image")
      .attr('x', -24)
      .attr('y', -24)
      .attr('width', 48)
      .attr('height', 48)
      .attr("xlink:href", d => `/src/assets/i/b/${d.id}.png`)
  nodeEnter.append("text")
      .attr("dy", 27)
      .attr( "text-anchor", "middle")
      .text(d => d.id );


  let started = false
  // Let's list the force we wanna apply on the network
  const simulation = d3.forceSimulation(dataNodes)                 // Force algorithm is applied to data.nodes
      .alphaMin(0.001)
      .force("link", d3.forceLink()                               // This force provides links between nodes
          .id(function(d) { return d.id; })                     // This provide  the id of a node
          .links(dataLinks)                                    // and this the list of links
      )
      //.force("charge", d3.forceManyBody().strength(-100))         // This adds repulsion between nodes. Play with the -400 for the repulsion strength
      .force("collider", d3.forceCollide( 75 ) )
      .force( "level", d3.forceX( d => {
        const weight = Object.keys( props.buildingMap.get( d.name ).data.consumption ?? {} ).length
        return weight * (width/maxConsumptionCount)
      }).strength(0.2))
      .force( "center", d3.forceY( height / 2).strength(0.2) )
      //.force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area

      // .force("level", d3.forceRadial( d => {
      //   const weight = Object.keys( buildingMap.get( d.name ).data.consumption ?? {} ).length
      //   return Math.max(0,  maxConsumptionCount - weight ) * 100
      // }, width / 2, height / 2 ) )
      .on("tick", ticked)
      .on("end", tickedDone);


  function ticked() {
    started = true
    link2
        .attr("x1", function(d) {
          const lx = d.target.x - d.source.x;
          const ly = d.target.y - d.source.y;
          return d.source.x + r * lx / Math.sqrt( lx * lx + ly * ly );
        })
        .attr("y1", function(d) {
          const lx = d.target.x - d.source.x;
          const ly = d.target.y - d.source.y;
          return d.source.y + r * ly / Math.sqrt( lx * lx + ly * ly );
        })
        .attr("x2", function(d) {
          const lx = d.target.x - d.source.x;
          const ly = d.target.y - d.source.y;
          return d.target.x - r * lx / Math.sqrt( lx * lx + ly * ly );
        } )
        .attr("y2", function(d) {
          const lx = d.target.x - d.source.x;
          const ly = d.target.y - d.source.y;
          return d.target.y - r * ly / Math.sqrt( lx * lx + ly * ly );
        });


    linkLabel
        .attr( "x", d => (d.target.x + d.source.x)/2 - 12 )
        .attr( "y", d => (d.target.y + d.source.y)/2 - 12 )

    nodeEnter
        // .attr("cx", function (d) { return d.x+6; })
        // .attr("cy", function(d) { return d.y-6; });
        .attr("fill", "red")
        .attr("transform", d => `translate(${d.x}, ${d.y})` )
  }

  function tickedDone() {
    //console.log( node )
    started = false
  }
})
</script>

<template>
  <svg   ref="wrapper"   width="800" height="600"></svg>
</template>

<style scoped>

</style>