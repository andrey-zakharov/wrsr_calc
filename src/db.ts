import {Building} from "./Building";
import db from "@/assets/buildings.json";

export const building = Object.keys( db.building_data ).map( bname => new Building(bname, db.building_data[bname]) )
export const buildingMap = new Map( building.map( b => [ b.id, b] ) )
