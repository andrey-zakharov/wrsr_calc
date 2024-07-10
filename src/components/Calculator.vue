<script setup lang="ts">

import db from "@/assets/buildings.json";
import {Building} from "@/Building.js";
import {computed, ref, UnwrapRef, watch} from "vue";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import Button from "primevue/button";
import SplitterPanel from "primevue/splitterpanel";
import Splitter from "primevue/splitter";
import TreeTable from "primevue/treetable";
import {building} from "@/db";
import {build} from "vite";
import Chip from 'primevue/chip';
import Menubar from "primevue/menubar";
import InputNumber from "primevue/inputnumber";
import workers_workers_loedu from '@/assets/i/g/workers_workers_loedu.png'

// 1 worker = 2m^3 per day of water?

const resources =  [...db.resources].sort()

const byProduction = new Map< string, Array<Building> >()
const byConsumption = new Map< string, Array<Building> >()

building.forEach( b => {
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
    // sort
    const ba = byProduction.get( c )
    if ( ba.length > 0 && ba[0].maxOutput[c] < b.maxOutput[c] ) {
      ba.unshift( b )
    } else {
      byProduction.get(c).push(b)
    }
  })
})
//
// console.log( byConsumption )
// console.log( byProduction )

// tons per day
const goal = ref( new Map< ResourceId, number >() )
const selectedResource = ref()

function resourceImgUrl(resName: string) { //return `@/assets/i/res/${resName}.png`
  return new URL(`../assets/i/res/${resName}.png`, import.meta.url).href
}

function buildingImgUrl(bid: BuildingId) {
  return new URL(`../assets/i/b/${bid}.png`, import.meta.url).href
}


function addGoal(res: ResourceId) {
  const bs = byProduction.get( res )
  // get max production of buildings producing this
  const tonsperday = bs?.reduce( (a, v) => {
    const bp = v.data.production[ res ]! * Math.max( 1, v.data.workers_needed )
    return Math.max( bp, a )
  }, 0) ?? 100

  if ( goal.value.has ( res ) ) {
    goal.value.set(res, goal.value.get(res) + tonsperday)
  } else {
    goal.value.set(res, tonsperday)
  }
  selectedResource.value = undefined
}

function removeGoal( res: ResourceId ) {
  goal.value.delete( res )
}

const goalsTable = computed( () => {
  return [ ... goal.value.keys() ].map( r => ({
    key: r,
    amount: disTonns( goal.value.get( r ) )
  }) )
})
//   resourceType: string,

type ResourceId = string

function buildingForResource( resource_name: string ) {
  //console.debug( resource_name, byProduction.has( resource_name ) )
  //console.assert( byProduction.has( resource_name ) )
  return byProduction.get( resource_name )?.at(0) // TBD here reduce by criteria
}



//recursive
function traverseAllNeeds(
    resource_name: ResourceId,
    amountPerDay: number,
    visited: Set<Building['id']> = new Set(),
) {
  const building = buildingForResource( resource_name )

  if ( building === undefined ) { // unknown
    // save to unsatisfied
    console.log( "unsatisfied:", resource_name, amountPerDay )
    return undefined
  }

  if ( visited.has( building.id ) ) {
    return undefined
  }
  const workersNeeded = building.data.workers_needed > 0 ?
      // precision bug hack
      ( amountPerDay * 100 )/ ( 100 * building.data.production[ resource_name ] ) // tonns per day
      : 0

  const professorsNeeded = workersNeeded ? building.data.professors_needed * workersNeeded / building.data.workers_needed : 0

  const efficiencyNeeded = building.data.workers_needed == 0 ?
      amountPerDay / building.data.production[ resource_name ] // tonns per day
      : workersNeeded / building.data.workers_needed

  const electricNeeded = building.data.consumption_per_second ?
          building.data.consumption_per_second['eletric'] * ( workersNeeded || efficiencyNeeded )
          : 0

  const children = (building.data.consumption ?? {})
  const res = {
    building: building,
    workersNeeded,
    professorsNeeded,
    efficiencyNeeded,
    electricNeeded,
    demands: [],
    products: Object.keys( building.data.production ).map( resource_name =>
        [ resource_name, building.data.production[ resource_name ] * ( workersNeeded || efficiencyNeeded ) ]
    )
  } as BuildingResult

  Object.keys(children).filter( x => byProduction.has( x ) ).forEach( cons => {
    const need = traverseAllNeeds( cons, workersNeeded * children[cons], new Set( [...visited, building.id]) )
    if ( need != undefined ) {
      res.demands.push(need)
    }
  } )

  return res
}

type BuildingId = string
type BuildingResult = {
  building: Building,
  workersNeeded: number,
  professorsNeeded: number,
  efficiencyNeeded?: number,
  electricNeeded: number,
  demands: BuildingResult[],
} // with sum operator

function appendBuildingResult( a: BuildingResult, b: BuildingResult ) {
  a.workersNeeded += b.workersNeeded
  if ( b.efficiencyNeeded !== undefined ) {
    a.efficiencyNeeded = (a.efficiencyNeeded ?? 0) + b.efficiencyNeeded
  }
}

// Дерево зданий, производящих необходимый объем.
const buildingsTree = computed( () => {

  // Необходимо решить задачу рюкзака, или показать варианты пользователю. Или иметь настройки минимизации.
  //const root = new Map<BuildingId, BuildingResult>()
  const res: Array<BuildingResult> = []

  goal.value.forEach( ( amount, resourceId ) => {

    const need = traverseAllNeeds( resourceId, amount )
    if ( need == undefined ) { return }
    res.push( need )
  } )

  return res
} )

function forEachDemandBuildingResult( root: BuildingResult, visit: (b: BuildingResult) => any ) {
  visit( root )
  root.demands.forEach( visit )
}

function sumDemands( root: UnwrapRef<ReturnType<typeof buildingsTree>>, fieldName: string ) {
  let sum = 0
  forEachDemandBuildingResult( root, res => {
    sum += res[fieldName] ?? 0
  })
  return sum
}


const columnSum = computed( () => ( fieldName: string ) => {
  return buildingsTree.value.reduce( (acc, val) => {
    return acc + sumDemands( val, fieldName )
  }, 0)
} )

/**
 *             return [
 *                 {
 *                     key: '0',
 *                     data: {
 *                         name: 'Applications',
 *                         size: '100kb',
 *                         type: 'Folder'
 *                     },
 *                     children: [
 *                         {
 *                             key: '0-0',
 *                             data: {
 *                                 name: 'Vue',
 *                                 size: '25kb',
 *                                 type: 'Folder'
 *                             },
 */
// adapter to PrimeVue
function convertBuildingToTreeNode(b: BuildingResult, keyPrefix?: string) {

  return {
    key: (keyPrefix ?? "") + b.building.id,
    data: {
      name: b.building.id,
      img: buildingImgUrl( b.building.id ),
      workers_needed: Math.ceil( b.workersNeeded ) + "/" + b.building.data.workers_needed,
      professors_needed: b.building.data.professors_needed ? Math.ceil( b.professorsNeeded ) + "/" + b.building.data.professors_needed : "",
      efficiency_needed: Math.ceil( b.efficiencyNeeded * 100 ?? 0 ),
      electricity_needed: Math.ceil( b.electricNeeded ),
      result: b
    },
    children: b.demands.map( x => convertBuildingToTreeNode(x, `${b.building.id}-` ) )
  }
}

// adapter
const buildingsNodes = computed( () => {
  const nodes = []
  buildingsTree.value.forEach( (v, k) => {
    nodes.push( convertBuildingToTreeNode(v) )
  })

  return nodes
} )
// sideeffect
watch( buildingsNodes, () => expandAll() )

const allKeys = computed( () => {

  //nodes.flatMap( x => [ x.key ] + x.children.map ( x ) )
  const queueToUnrollRecursivity = [ ...buildingsNodes.value ]
  const allKeys = []

  while( queueToUnrollRecursivity.length > 0 ) {
    const current = queueToUnrollRecursivity.pop()
    if ( current.children.length > 0 ) {
      allKeys.push(current.key)
    }
    queueToUnrollRecursivity.push( ... current.children )
  }

  return allKeys
})

const expandedKeys = ref()

// adapter
const allExpandedKeys = computed( () => {
  return allKeys.value.reduce( (acc, v) => {
    acc[ v ] = true
    return acc
  }, {})
})

function expandAll() {
  expandedKeys.value = allExpandedKeys.value
}

function collapseAll() {
  expandedKeys.value = {}
}

const isExpanded = computed( () =>JSON.stringify( expandedKeys.value ) == JSON.stringify( allExpandedKeys.value ) )
const isCollapsed = computed( () => Object.keys( expandedKeys.value ).length == 0 )

function reset() {
  goal.value.clear()
}

function disTonns(v: number) { return (Math.round( v * 1000 ) / 1000).toString() }

function onCellEditComplete(a) {
  console.log(a)
}

Array.prototype.equals = function( array ) {
  return this.length == array.length &&
      this.every( function(this_i,i) { return this_i == array[i] } )
}


</script>

<template>
<!--  <Menubar :model="[ {-->
<!--    label: 'Reset',-->
<!--    command: () => reset()-->
<!--  }]">-->

<!--  </Menubar>-->
  <Splitter layout="vertical">
    <SplitterPanel>
      <!--      <Dropdown v-model="selectedResource" :options = "resources" placeholder="select goal resource" @update:modelValue="addGoal($event)">
        <template #option="slotProps">
          <div class="flex align-items-center">
            <img :alt="slotProps.option" :src="imgUrl(slotProps.option)" class="mr-2"
                 style="width: 48px" />
            <div>{{ slotProps.option }}</div>
          </div>
        </template>
      </Dropdown>-->
      <!--VirtualScroller :items="resources" orientation="horizontal" style="width: 100%; height: 100px" itemSize="50">
        <template v-slot:item="{ item, options }">
          <Button raised outlined plain class="m-1">
            <div class="flex align-items-center" style="width: 200px">
              <img :alt="item" :src="imgUrl(item)" class="mr-2"
                   style="width: 48px" />
              <div>{{ item }}</div>
            </div>
          </Button>
        </template>
      </VirtualScroller-->
      <div class="overflow-x-auto overflow-y-hidden white-space-nowrap">
<!--        <Button @click="reset()" label="Reset"/>-->
        <Button v-for="item in resources" raised outlined plain class="m-1" @click="addGoal(item)">
          <div class="flex align-items-center flex-column">
            <img :alt="item" :src="resourceImgUrl(item)" class="mr-2" style="width: 48px" />
            <div>{{ item }}</div>
          </div>
        </Button>
      </div>
      <DataTable stripedRows
                 :value="goalsTable" tableStyle="min-width: 50rem"
                 v-if="goalsTable.length > 0"
                 size="small"
                 editMode="cell" @cell-edit-complete="onCellEditComplete"
      >
        <template #header>
          <div class="flex flex-wrap align-items-center justify-content-between gap-2">
            <h1 class="font-bold text-lg">Goal</h1>
<!--            <Button raised outlined title="clear all" @click="reset" size="small" class="p-0">-->
            <a @click="reset">
              <img src="@/assets/i/g/button_deleteall.png" width="48" height="48">
            </a>
<!--            </Button>-->
          </div>
        </template>
        <Column header="Icon" class="w-3rem">
          <template #body="{ data }">
            <img :alt="data.key" :src="resourceImgUrl(data.key)" style="width: 24px" class="white-space-nowrap" />
          </template>
        </Column>
        <Column field="key" header="Resource"></Column>
        <Column field="amount" header="Amount, t/day" class="w-5">
          <template #editor="{ data, field }">
            <InputNumber :modelValue="goal.get(data.key)" @update:modelValue="goal.set( data.key, $event )" showButtons buttonLayout="horizontal"/>
          </template>
        </Column>
        <Column class="w-3rem">
          <template #body="{data}">
            <a @click="removeGoal( data.key )">
              <img src="@/assets/i/g/button_cancel.png" width="48" height="48">
            </a>
          </template>
        </Column>
      </DataTable>
    </SplitterPanel>
    <SplitterPanel>

      <TreeTable v-if="buildingsNodes.length > 0"
                 size="small"
                 :value="buildingsNodes"
                 v-model:expandedKeys="expandedKeys">
        <template #header>
          <div class="flex flex-wrap align-items-center justify-content-between gap-2">
            <h1 class="font-bold text-lg">Building plan</h1>
            <div>
            <Button rounded raised label="Expand all" @click="expandAll" size="small" class="mx-2" :disabled="isExpanded"/>
            <Button rounded raised label="Collapse all" @click="collapseAll" size="small" :disabled="isCollapsed"/>
            </div>
          </div>
        </template>
<!--        <Column expander class="w-5rem"></Column>-->
        <Column field="name" header="Building" expander :pt="{ root: 'white-space-nowrap' }" class="w-20rem">
          <template #footer="{ column }">Total:</template>
<!--          <template #body="{ node }">-->
<!--&lt;!&ndash;              <span class="inline-flex align-items-center">&ndash;&gt;-->
<!--&lt;!&ndash;              <img :alt="node.key" :src="buildingImgUrl(node.data.name)" style="width: 48px" />&ndash;&gt;-->
<!--              <span>{{node.data.name}}</span>-->
<!--              </span>-->
<!--          </template>-->
        </Column>
        <Column header="Icon" class="w-4rem">
          <template #body="{ node }">
<!--              <span class="inline-flex align-items-center">-->
              <img :alt="node.key" :src="buildingImgUrl(node.data.name)" style="width: 48px" class="white-space-nowrap"/>
<!--              <span>{{node.data.name}}</span>-->
<!--              </span>-->
          </template>
        </Column>
        <Column field="products" header="Products, tons/day">
          <template #body="{ node }">
            <Chip v-for="productResult in node.data.result.products"
                  :label="disTonns(productResult[1])"
                  :image="resourceImgUrl(productResult[0])" class="mx-1"
              :title="productResult[0]"
            />

          </template>
        </Column>
        <Column field="consumes" header="Consumes, tons/day">
          <template #body="{ node }">
            <Chip v-for="(demand, resource) in (node.data.result.building.data.consumption ?? {})"
                  :label="disTonns(demand * (node.data.result.workersNeeded || node.data.result.efficiencyNeeded ))"
                  :image="resourceImgUrl(resource)"
                  class="mx-1"
                  :title="resource"
            />
          </template>
        </Column>
        <Column field="workers_needed" header="Workers needed">
<!--          <template #body="{ node }">-->
<!--            <div :style="{-->

<!--              width: node.workersNeeded + 'px'-->
<!--            }" class="workers-bg"></div>-->
<!--          </template>-->
          <template #footer="{ column }">{{ Math.ceil( columnSum('workersNeeded') ) }}</template>
        </Column>
        <Column field="professors_needed" header="Professors needed">
          <template #footer="{ column }">{{ Math.ceil( columnSum('professorsNeeded') ) }}</template>
        </Column>
        <Column field="efficiency_needed" header="Efficiency needed, %"></Column>
        <Column field="electricity_needed" header="Electricity needed, kW*h">
          <template #footer="{ column }">{{ Math.ceil( columnSum('electricNeeded') ) }}</template>
        </Column>
<!--        <Column field="buildplan" header="Plan">-->
<!--          <template #body="{ node }">-->
<!--            <pre>{{ node.data.result }}</pre>-->

<!--          </template>-->
<!--        </Column>-->
      </TreeTable>
<!--      <pre>{{buildingsTree}}</pre>-->
    </SplitterPanel>
  </Splitter>
</template>

<style scoped>
.workers-bg {
  background: url('@/assets/i/g/workers_workers_loedu.png') repeat-x -4px 0;
  background-size: 16px 24px;
  height: 24px;
}

</style>