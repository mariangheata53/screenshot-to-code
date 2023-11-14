import { useState } from "react";
import ImageUpload from "./components/ImageUpload";
import CodePreview from "./components/CodePreview";

function App() {
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  return (
    <div className="mx-auto mt-10 max-w-2xl">
      <h1 className="text-2xl mb-4">Drag & Drop a Screenshot</h1>
      {referenceImages.length > 0 && (
        <img
          className="w-[300px]"
          src={referenceImages[0].data}
          alt="Reference"
        />
      )}

      <CodePreview content="Hello World" />

      {referenceImages.length === 0 && (
        <>
          <ImageUpload setReferenceImages={setReferenceImages} />
        </>
      )}
    </div>
  );
}

export default App;
