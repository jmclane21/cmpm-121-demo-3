// todo
const app = document.querySelector<HTMLDivElement>("#app")!;

const testButton = document.createElement("button");
testButton.innerHTML = "Test Button";
testButton.onclick = () => {
  alert("Test Button Clicked!");
};
app.append(testButton);
