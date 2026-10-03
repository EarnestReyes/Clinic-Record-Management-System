import { initialData } from "./mockData";
export function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem('careline-data-v1'));
    return saved?.patients ? saved : initialData();
  } catch {
    return initialData();
  }
}
