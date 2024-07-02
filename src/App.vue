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

const goal = ref( new Map< string, number >() )
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

//const minimizer( )
type Demand = {
  buildingType: Building,
  workersNeeded: number,
  efficiencyNeeded?: number,
} // with sum operator

function buildingForResource( resource_name: string ) {
  console.assert( byProduction.has( resource_name ) )
  console.debug( byProduction.has( resource_name ) )
  return byProduction.get( resource_name )!.at(0) // TBD here reduce by criteria
}
//recursive
function traverseAllNeeds( resource_name: string, amountPerDay: number, visit: (demand: Demand) => void ) {
  const buildingType = buildingForResource( resource_name )

  const workersNeeded = amountPerDay / buildingType.data.production[ resource_name ] // tonns per day

  visit( { buildingType, workersNeeded } )

  const children = (buildingType.data.consumption ?? {})

  Object.keys(children).forEach( cons => {
    traverseAllNeeds( cons, workersNeeded * children[cons], visit )
  })
}

// Дерево зданий, производящих необходимый объем.
const materialTree = computed( () => {

  // Необходимо решить задачу рюкзака, или показать варианты пользователю. Или иметь настройки минимизации.
  const products = new Map<string, Demand>()

  goalsTable.value.forEach( goal => {

    traverseAllNeeds( goal.key, goal.amount, d => {
      if ( !products.has( d.buildingType.id ) ) {
        products.set( d.buildingType.id, d )
      } else {
        const p = products.get( d.buildingType.id )
        p.workersNeeded += d.workersNeeded
        p.efficiencyNeeded += d.efficiencyNeeded
      }
    })
  } )

  return products
})
const buildingsNodes = computed( () => {
  const nodes = []
  materialTree.value.forEach( (v, k) => {
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
