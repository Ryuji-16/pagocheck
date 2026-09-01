import Header from './components/Header'
import UploadZone from './components/UploadZone'
import './App.css'

function App() {
  return (
    <>
      <Header />

      <main>
        <h1>Verifica tu pago</h1>
        
        <p>
          Comprueba que el pago fue recibido correctamente.
        </p>

        <UploadZone />
      </main>
    </>
  )
}

export default App