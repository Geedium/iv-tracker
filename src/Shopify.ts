import { IStore } from "./IStore";
import { Product } from "./Product";

export default class Shopify implements IStore {
    products: Product<"Shopify">[] = [];
    
    migrate(vendor: string, dest: IStore) {
        
    }
}
