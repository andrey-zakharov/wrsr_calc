<script setup lang="ts">
import {onMounted, ref, toRaw} from "vue";

import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

import OverallGraph from "@/components/OverallGraph.vue";
import Calculator from "@/components/Calculator.vue";

const panel = ref()

onMounted( () => {
  console.log( toRaw( panel.value ) )
})

</script>

<template>
  <TabView>

    <TabPanel header="Calculator">
      <Calculator></Calculator>
    </TabPanel>

    <TabPanel header="Overall Graph" ref="panel">
      <!--      <div class="wrapper relative w-full h-full" ref="wrapper">-->
      <OverallGraph></OverallGraph>
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

>>> .p-tabview-panel {
  height: 100vb;
}

</style>
