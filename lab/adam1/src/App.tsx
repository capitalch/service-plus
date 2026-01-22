// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import { Button } from "@/components/ui/button";
import './App.css'
import { AlertTriangle } from "lucide-react";

function App() {
  return (
    <div className="p-6 flex items-center gap-4">
      <h1 className="text-3xl font-bold text-green-600 ">
        Tailwind v4 is working!
      </h1>
      <Button variant='default' size='lg'>
        <AlertTriangle />
        Warning
      </Button>
    </div>
  );
}

export default App
