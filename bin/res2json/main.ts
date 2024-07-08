#!/usr/bin/env -S npx vite-node main.ts
// var exports = {};
const gameDir = "G:\\SteamLibrary\\steamapps\\common\\SovietRepublic\\media_soviet\\"
const resultDir = "./"
import * as os from 'os'
import * as fs from 'fs'
import * as promises from 'node:fs/promises'

// console.log( process.argv )
const bdata = await building_data()


const ress = resources_data( bdata )
//
fs.writeFileSync(resultDir + "buildings.json", JSON.stringify({
    building_data: bdata, resources: [ ... ress.values() ]
}, undefined, 2))

const imageDir = resultDir + "i"
if ( !fs.existsSync( imageDir ) ) {
    fs.mkdirSync(imageDir)
}
Object.keys( bdata ).forEach( bn => {
    const iname = gameDir + `editor\\tool_${bn}.png`
    fs.copyFileSync( iname, resultDir + `i/${bn}.png`)
})

async function building_data() {
    const dir = gameDir + "buildings_types"
    const files = fs.readdirSync(dir, {recursive: true}).filter(fn => fn.split('.').pop() === "ini")

    const building_data: Record<string, ReturnType<typeof visitMeta>> = {}

    await Promise.all(files.map(async (fn: string) => {
// const fn = files.pop() as string
        //console.log( `=== ${fn}`)
        const meta = await visitFile(dir, fn as string)
        const data = visitMeta(fn, meta)
        if (data == undefined) return

        const bname = fn.split(".").slice(0, -1).join("")
        building_data[bname] = data
    }))

    return building_data
}

async function visitFile( dir: string, filename: string ) {
    //const data = fs.readFileSync(filename, 'utf8');
    const file = await promises.open(dir + "/" + filename);

    const map = new Map<string, Array<string>>()
    for await (const line of file.readLines()) {
        if ( !line.startsWith("$") ) continue

        const m = [... line.matchAll( /^\$([a-zA-Z_]+) ?(.*)$/gm ) ]
        if ( m.length == 0 ) continue
        const k = m[0][1].toLowerCase()
        const v = m[0][2]

        // if ( v.length == 0 ) {// but matched
        //     map.set(k, true)
        //     continue
        // }

        if ( !map.has( k ) ) {
            map.set( k, [] )
        }
        if ( v.length == 0 ) continue
        //console.log( k, v, map.get( k ) );
        map.get( k ).push( v )
    }
    if ( map.size == 0 ) {
        console.log( filename )
    }
    return map
}

function visitMeta( fn: string, map: Awaited<ReturnType<typeof visitFile>> ) {
    if ( !map.has("production") ) return undefined
    if ( map.has( "obsolete" ) ) return undefined
    // console.log( fn, map )
    return {
        name: parseInt( map.get( "name" ).pop() ),
        sound: map.get( "ambient_sfx" )?.pop(),
        workers_needed: map.get("workers_needed") ? parseInt( map.get("workers_needed")?.pop() ) : 0,
        professors_needed: map.get("profesors_needed") ? parseInt( map.get("profesors_needed")?.pop() ) : 0,
        consumption: parseMaterials( map.get("consumption") ),
        consumption_per_second: parseMaterials( map.get("consumption_per_second") ),
        production: parseMaterials( map.get("production") ),
        cost_work: map.get( "cost_work" ),
        cost_resource: map.get( "cost_resource" ),
    }
}

function parseMaterials(elems: Array<string> | undefined ) {
    return elems?.reduce( (acc, line) => {
        const [ m, v ] = line.split(/[ \t]/ )
        acc[m] = parseFloat(v)
        return acc
    }, {} )
}
 function resources_data( bdata: Awaited<ReturnType<typeof building_data>> ) {
    const r = new Set()
    Object.values( bdata ).forEach( m => {
       Object.keys( m.consumption ?? {} ).forEach( mat => r.add(mat) )
       Object.keys( m.production ?? {} ).forEach( mat => r.add(mat) )
    })

    return r
}