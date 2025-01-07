import { useState } from "react";
import { mutual_link_backend } from "declarations/mutual-link-backend";
import Home from "./pages/Home/Home";

function App() {
  const [greeting, setGreeting] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const name = event.target.elements.name.value;
    mutual_link_backend.greet(name).then((greeting) => {
      setGreeting(greeting);
    });
    return false;
  }

  return (
    <main>
      <Home />
    </main>
  );
}

export default App;
