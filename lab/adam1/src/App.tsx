import { ComponentExample } from "@/components/component-example";
import { Button } from "@/components/ui/button";

export function App() {
    return (
    <div className="p-4">
        <ComponentExample />
        <Button variant='destructive' className="mt-4">Delete</Button>
    </div>);
}

export default App;