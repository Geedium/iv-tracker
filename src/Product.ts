import Shopify from "shopify-api-node";

namespace OpenCart {
    export interface Category {
        name: string;
        category_id: number;
    }

    export interface Manufacturer {
        name: string;
        manufacturer_id: number;
    }
    
    export interface Attribute {
        name: string;
        attribute_id: number;
        text: string;
    }

    export interface Product {
        SKU: string;
        Title: string;
        Language: string;
        Description: string;
        Category: Category[];
        Manufacturer: Manufacturer;
        Currency: "EUR";
        Quantity: number;
        Price: number;
        Special: number;
        Condition: "NEW";
        _attributes: Attribute[];
        Extra_image_1: string;
        _images: string[];
    }
}

export type Product<T extends "Shopify" | "OpenCart"> 
    = T extends "Shopify" ? Shopify.IProduct : OpenCart.Product;
