// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import { Button } from './components/ui/button'

function App() {
  return (<div className="min-h-screen bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
    <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Tailwind v4 is working! 🎉
      </h1>
      <p className="text-gray-600">
        Zero configuration, blazingly fast, and ready for shadcn/ui!
      </p>
      <Button variant='default' size='lg'>Click Me</Button>
    </div>
  </div>)
}

export default App
