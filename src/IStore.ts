export interface IStore {
    migrate: (vendor: string, dest: IStore) => void;
}
