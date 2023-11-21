import { useRef, useState } from "react";
import ImageUpload from "./components/ImageUpload";
import CodePreview from "./components/CodePreview";
import Preview from "./components/Preview";
import { CodeGenerationParams, generateCode } from "./generateCode";
import Spinner from "./components/Spinner";
import classNames from "classnames";
import {
  FaCode,
  FaDesktop,
  FaDownload,
  FaMobile,
  FaUndo,
} from "react-icons/fa";
import { Switch } from "./components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import CodeMirror from "./components/CodeMirror";
import SettingsDialog from "./components/SettingsDialog";
import { AppStatus, Settings, USER_CLOSE_WEB_SOCKET_CODE } from "@/types";
import { IS_RUNNING_ON_CLOUD } from "./config";
import { PicoBadge } from "./components/PicoBadge";
import { OnboardingNote } from "./components/OnboardingNote";
import { usePersistedState } from "./hooks/usePersistedState";
import { UrlInputSection } from "./components/UrlInputSection";
import TermsOfServiceDialog from "./components/TermsOfServiceDialog";
import html2canvas from 'html2canvas';


function App() {
  const [appState, setAppState] = useState<AppStatus>(
    AppStatus.INITIAL
  );
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [executionConsole, setExecutionConsole] = useState<string[]>([]);
  const [updateInstruction, setUpdateInstruction] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [settings, setSettings] = usePersistedState<Settings>(
    {
      openAiApiKey: null,
      screenshotOneApiKey: null,
      isImageGenerationEnabled: true,
      editorTheme: "cobalt",
    },
    "setting"
  );
  const [isImgCompare, setIsImgCompare] = useState<boolean>(false);
  const wsRef = useRef<WebSocket>(null);

  const takeScreenshot = async (): Promise<string> => {
		const iframeElement = document.querySelector('#preview-desktop') as HTMLIFrameElement;
    if (!iframeElement?.contentWindow?.document.body) {
      return '';
    }

    const canvas = await html2canvas(iframeElement.contentWindow.document.body);
		const png = canvas.toDataURL('image/png');
    return png;
  }

  const downloadCode = () => {
    // Create a blob from the generated code
    const blob = new Blob([generatedCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Create an anchor element and set properties for download
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html"; // Set the file name for download
    document.body.appendChild(a); // Append to the document
    a.click(); // Programmatically click the anchor to trigger download

    // Clean up by removing the anchor and revoking the Blob URL
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setAppState(AppStatus.INITIAL);
    setGeneratedCode("");
    setReferenceImages([]);
    setExecutionConsole([]);
    setHistory([]);
  };

  const stop = () => {
    wsRef.current?.close?.(USER_CLOSE_WEB_SOCKET_CODE);
    // make sure stop can correct the state even if the websocket is already closed
    setAppState(AppStatus.CODE_READY);
  }

  function doGenerateCode(params: CodeGenerationParams) {
    setExecutionConsole([]);
    setAppState(AppStatus.CODING);

    // Merge settings with params
    const updatedParams = { ...params, ...settings };

    generateCode(
      wsRef,
      updatedParams,
      (token) => setGeneratedCode((prev) => prev + token),
      (code) => setGeneratedCode(code),
      (line) => setExecutionConsole((prev) => [...prev, line]),
      () => setAppState(AppStatus.CODE_READY)
    );
  }

  // Initial version creation
  function doCreate(referenceImages: string[]) {
    setReferenceImages(referenceImages);
    if (referenceImages.length > 0) {
      doGenerateCode({
        generationType: "create",
        image: referenceImages[0],
      });
    }
  }

  // Subsequent updates
  async function doUpdate() {
    const updatedHistory = [...history, generatedCode, updateInstruction];
    if (isImgCompare) {
      const resultImg = await takeScreenshot();
      doGenerateCode({
        generationType: "update",
        image: referenceImages[0],
        resultImg: resultImg,
        history: updatedHistory,
      });
    } else {
      doGenerateCode({
        generationType: "update",
        image: referenceImages[0],
        history: updatedHistory,
      });
    }

    setHistory(updatedHistory);
    setGeneratedCode("");
    setUpdateInstruction("");
  }

  return (
    <div className="mt-2">
      {IS_RUNNING_ON_CLOUD && <PicoBadge />}
      {IS_RUNNING_ON_CLOUD && <TermsOfServiceDialog />}

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-96 lg:flex-col">
        <div className="flex grow flex-col gap-y-2 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex items-center justify-between mt-10">
            <h1 className="text-2xl ">Screenshot to Code</h1>
            <SettingsDialog settings={settings} setSettings={setSettings} />
          </div>
          {appState === AppStatus.INITIAL && (
            <h2 className="text-sm text-gray-500 mb-2">
              Drag & drop a screenshot to get started.
            </h2>
          )}

          {IS_RUNNING_ON_CLOUD && !settings.openAiApiKey && <OnboardingNote />}

          {(appState === AppStatus.CODING || appState === AppStatus.CODE_READY) && (
            <>
              {/* Show code preview only when coding */}
              {appState === AppStatus.CODING && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-x-1">
                    <Spinner />
                    {executionConsole.slice(-1)[0]}
                  </div>
                  <div className="flex mt-4 w-full">
                    <Button
                      onClick={stop}
                      className="w-full"
                    >
                      Stop
                    </Button>
                  </div>
                  <CodePreview code={generatedCode} />
                </div>
              )}

              {appState === AppStatus.CODE_READY && (
                <div>
                  <div className="grid w-full gap-2">
                   <div className="flex justify-between items-center gap-x-2">
                      <div className="font-500">
                        Auto Image Comparison
                      </div>
                      <Switch
                          checked={isImgCompare}
                          onCheckedChange={setIsImgCompare}
                      />
                    </div>
                    <Textarea
                      placeholder="Tell the AI what to change..."
                      onChange={(e) => setUpdateInstruction(e.target.value)}
                      value={updateInstruction}
                    />
                    <Button onClick={doUpdate}>Update</Button>
                  </div>
                  <div className="flex items-center gap-x-2 mt-2">
                    <Button
                      onClick={downloadCode}
                      className="flex items-center gap-x-2"
                    >
                      <FaDownload /> Download
                    </Button>
                    <Button
                      onClick={reset}
                      className="flex items-center gap-x-2"
                    >
                      <FaUndo />
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Reference image display */}
              <div className="flex gap-x-2 mt-2">
                <div className="flex flex-col">
                  <div
                    className={classNames({
                      "scanning relative": appState === AppStatus.CODING,
                    })}
                  >
                    <img
                      className="w-[340px] border border-gray-200 rounded-md"
                      src={referenceImages[0]}
                      alt="Reference"
                    />
                  </div>
                  <div className="text-gray-400 uppercase text-sm text-center mt-1">
                    Original Screenshot
                  </div>
                </div>
                <div className="bg-gray-400 px-4 py-2 rounded text-sm hidden">
                  <h2 className="text-lg mb-4 border-b border-gray-800">
                    Console
                  </h2>
                  {executionConsole.map((line, index) => (
                    <div
                      key={index}
                      className="border-b border-gray-400 mb-2 text-gray-600 font-mono"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <main className="py-2 lg:pl-96">
        {appState === AppStatus.INITIAL && (
          <div className="flex flex-col justify-center items-center gap-y-10">
            <ImageUpload setReferenceImages={doCreate} />
            <UrlInputSection
              doCreate={doCreate}
              screenshotOneApiKey={settings.screenshotOneApiKey}
            />
          </div>
        )}

        {(appState === AppStatus.CODING || appState === AppStatus.CODE_READY) && (
          <div className="ml-4">
            <Tabs defaultValue="desktop">
              <div className="flex justify-end mr-8 mb-4">
                <TabsList>
                  <TabsTrigger value="desktop" className="flex gap-x-2">
                    <FaDesktop /> Desktop
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="flex gap-x-2">
                    <FaMobile /> Mobile
                  </TabsTrigger>
                  <TabsTrigger value="code" className="flex gap-x-2">
                    <FaCode />
                    Code
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="desktop">
                <Preview code={generatedCode} device="desktop" />
              </TabsContent>
              <TabsContent value="mobile">
                <Preview code={generatedCode} device="mobile" />
              </TabsContent>
              <TabsContent value="code">
                <CodeMirror
                  code={generatedCode}
                  editorTheme={settings.editorTheme}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
