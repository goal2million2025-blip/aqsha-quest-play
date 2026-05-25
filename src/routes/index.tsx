import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "AqshaLingo — Қаржылық сауаттылық ойыны" },
      {
        name: "description",
        content:
          "AqshaLingo — Duolingo-style ойын арқылы қаржылық сауаттылықты үйрен. Бюджет, жинақ, инвестиция, несие, сақтандыру.",
      },
    ],
  }),
});

function Index() {
  return (
    <iframe
      src="/game/index.html"
      title="AqshaLingo"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
      }}
    />
  );
}
