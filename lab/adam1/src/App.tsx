// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import { Button } from "@/components/ui/button";
import './App.css'

function App() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-green-600">
        Tailwind v4 is working
        <Button variant='default'>Test</Button>
      </h1>
    </div>
  );
}

export default App
