const response = await fetch("http://localhost:3000/remedios/6", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
});

const json = await response.json();

console.log(json);
