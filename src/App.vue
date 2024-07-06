<script setup lang="ts">
import db from '@/assets/buildings.json'
import {computed, onMounted, ref, toRaw} from "vue";
import {Building} from "@/Building";
import TreeTable from 'primevue/treetable';
import Column from 'primevue/column';
import Splitter from 'primevue/splitter';
import SplitterPanel from 'primevue/splitterpanel';
import DataTable from 'primevue/datatable';
import Button from 'primevue/button';

import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

import OverallGraph from "@/components/OverallGraph.vue";
import {build} from "vite";

const resources =  [...db.resources].sort()
const building = Object.keys( db.building_data ).map( bname => new Building(bname, db.building_data[bname]) )

const buildingMap = new Map( building.map( b => [ b.id, b] ) )
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
    byProduction.get( c ).push( b )
  })
})
//
// console.log( byConsumption )
// console.log( byProduction )

// tons per day
const goal = ref( new Map< ResourceId, number >() )
const selectedResource = ref()

function imgUrl(resName: string) { //return `@/assets/i/res/${resName}.png`
  return new URL(`./assets/i/res/${resName}.png`, import.meta.url).href
}

function addGoal(res: string) {
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

const goalsTable = computed( () => {
  return [ ... goal.value.keys() ].map( r => ({
      key: r,
      amount: goal.value.get( r )
  }) )
})
//   resourceType: string,

type ResourceId = string

function buildingForResource( resource_name: string ) {
  console.debug( resource_name, byProduction.has( resource_name ) )
  //console.assert( byProduction.has( resource_name ) )
  return byProduction.get( resource_name )!.at(0) // TBD here reduce by criteria
}

//recursive
function traverseAllNeeds( resource_name: ResourceId, amountPerDay: number, visit: (demand: BuildingResult) => void, visited: Set<Building['id']> = new Set() ) {
  const buildingType = buildingForResource( resource_name )

  if ( visited.has( buildingType.id ) ) {
    return
  }

  visited.add( buildingType.id )

  const workersNeeded = amountPerDay / buildingType.data.production[ resource_name ] // tonns per day

  const children = (buildingType.data.consumption ?? {})

  visit( { buildingId: buildingType.id, workersNeeded } )


  Object.keys(children).filter( x => byProduction.has( x ) ).forEach( cons => {
    traverseAllNeeds( cons, workersNeeded * children[cons], visit, visited )
  } )
}

type BuildingId = string
type BuildingResult = {
  buildingId: BuildingId,
  workersNeeded?: number,
  efficiencyNeeded?: number,
} // with sum operator

function appendBuildingResult( a: BuildingResult, b: BuildingResult ) {
  a.workersNeeded += b.workersNeeded
  a.efficiencyNeeded += b.efficiencyNeeded
}

// Дерево зданий, производящих необходимый объем.
const buildingsTree = computed( () => {

  // Необходимо решить задачу рюкзака, или показать варианты пользователю. Или иметь настройки минимизации.
  const root = new Map<BuildingId, BuildingResult>()

  goal.value.forEach( ( amount, resourceId ) => {

    traverseAllNeeds( resourceId, amount, d => {
      if ( !root.has( d.buildingId ) ) {
        root.set( d.buildingId, d )
      } else {
        const p = root.get( d.buildingId )
        appendBuildingResult( p, d )
      }
    })
  } )

  return root
} )

const buildingsNodes = computed( () => {
  const nodes = []
  buildingsTree.value.forEach( (v, k) => {
    nodes.push( {
      key: k,
      data: {
        name: k,
        workers_needed: v.workersNeeded
      }
    } )

  })

  return nodes
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
const panel = ref()

onMounted( () => {
  console.log( toRaw( panel.value ) )

})

function reset() {
  goal.value.clear()
}

</script>

<template>
  <TabView class="w-full h-full">

    <TabPanel header="Calculator">
  <Splitter layout="vertical" class="w-full h-full">
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
        <Button @click="reset()" label="Reset"/>
          <Button v-for="item in resources" raised outlined plain class="m-1" @click="addGoal(item)">
            <div class="flex align-items-center flex-column">
              <img :alt="item" :src="imgUrl(item)" class="mr-2"
                   style="width: 48px" />
              <div>{{ item }}</div>
            </div>
          </Button>
      </div>
      <DataTable :value="goalsTable" tableStyle="min-width: 50rem">
        <Column field="key" header="Resource"></Column>
        <Column field="amount" header="Amount, t/day"></Column>
      </DataTable>
    </SplitterPanel>
    <SplitterPanel>


      <TreeTable :value="buildingsNodes">
        <Column field="name" header="Name" expander></Column>
        <Column field="workers_needed" header="Workers needed"></Column>
      </TreeTable>
    </SplitterPanel>
  </Splitter>
    </TabPanel>

    <TabPanel header="Overall Graph" ref="panel">
      <!--      <div class="wrapper relative w-full h-full" ref="wrapper">-->
      <OverallGraph :buildingMap="buildingMap" width="100%"></OverallGraph>
      <!--      </div>-->
    </TabPanel>

  </TabView>
</template>

<style scoped>
header {
  line-height: 1.5;
}

@media (min-width: 1024px) {
  header {
    display: flex;
    place-items: center;
    padding-right: calc(var(--section-gap) / 2);
  }
}
</style>
