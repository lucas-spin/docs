import { Component, IFrameElement, DivElement, HBox, VBox, ButtonElement } from "typecomposer";
import { compileFiles, initializeEsbuild } from "@/utils/browserCompiler";
import { MonacoEditor } from "@/components/editor/MonacoEditor";

// Keep the CDN version in sync with the typecomposer dependency in package.json.
// Update this constant whenever the typecomposer dependency is bumped.
const TYPECOMPOSER_VERSION = "0.1.56";

const files = {
	"/tsconfig.json": {
		code: `
		{
		  "compilerOptions": {
			"target": "ESNext",
			"useDefineForClassFields": true,
			"module": "ESNext",
			"lib": ["ES2021", "DOM", "DOM.Iterable"],
			"skipLibCheck": true,
			"moduleResolution": "node",
			"allowImportingTsExtensions": true,
			"resolveJsonModule": true,
			"isolatedModules": true,
			"noEmit": true,
			"allowSyntheticDefaultImports": true,
			"strict": true,
			"noUnusedLocals": true,
			"noUnusedParameters": true,
			"noFallthroughCasesInSwitch": true,
			"experimentalDecorators": true,
			"emitDecoratorMetadata": true,
			"baseUrl": ".",
			"paths": {
			  "@/*": ["src/*"]
			},
			"types": ["vite/client", "typecomposer-plugin/client", "typecomposer/typings"]
		  },
		  "include": ["src"]
		}
	  `,
	},
	"/vite.config.js": {
		code: `
		import { defineConfig } from "vite";
		import typeComposerPlugin from "typecomposer-plugin";
		import path from "path";
  
		export default defineConfig({
		  plugins: [typeComposerPlugin()],
		  resolve: {
			alias: {
			  "@": path.resolve(__dirname, "./src"),
			},
		  },
		  css: {
			preprocessorOptions: {
			  scss: {
				api: "modern-compiler",
			  },
			},
		  },
		});
	  `,
	},
	"/package.json": {
		code: `
		{
		  "name": "typecomposer-playground",
		  "private": true,
		  "version": "0.0.0",
		  "type": "module",
		  "main": "/index.html",
		  "scripts": {
		   	"dev": "vite",
			"start": "vite",
			"build": "vite build",
			"preview": "vite"
		  },
		  "dependencies": {
			"typecomposer": "^${TYPECOMPOSER_VERSION}"
		  },
		  "devDependencies": {
			"@types/node": "^22.0.0",
			"autoprefixer": "^10.4.20",
			"csstype": "^3.1.3",
			"sass": "^1.79.4",
			"tailwindcss": "^4.0.0",
			"typecomposer-plugin": "^1.0.0",
			"typescript": "^5.6.0",
			"vite": "^7.0.0"
		  }
		}
	  `,
	},
	"/index.html": {
		code: `<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/typecomposer.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TypeCompose</title>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
	},
	"/src/main.ts": {
		code: `import { AppPage } from "./AppPage";

const app = new AppPage();
document.body.appendChild(app);`,
	},
	"/src/AppPage.ts": {
		code: `import { VBox, DivElement, ButtonElement } from "typecomposer";

export class AppPage extends VBox {
  private clickCount = 0;
  private button: ButtonElement;
  
  constructor() {
    super({
      style: {
        padding: "40px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "20px",
      }
    });

    const title = new DivElement({
      innerText: "🎨 TypeComposer Playground",
      style: {
        color: "white",
        fontSize: "48px",
        fontWeight: "bold",
        margin: "0"
      }
    });
    
    this.button = new ButtonElement({
      innerText: "Click me!",
      style: {
        padding: "12px 24px",
        fontSize: "16px",
        background: "white",
        color: "#667eea",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: "600",
        transition: "transform 0.2s"
      }
    });
    
    this.button.onclick = () => {
      this.clickCount++;
      this.button.innerText = \`Clicked \${this.clickCount} time\${this.clickCount === 1 ? '' : 's'}!\`;
      this.button.style.transform = "scale(1.1)";
      setTimeout(() => {
        this.button.style.transform = "scale(1)";
      }, 150);
    };
    
    // Append all elements
    this.appendChild(title);
    this.appendChild(this.button);
  }
}
customElements.define("app-page", AppPage);  
`,
	},
};


export class PlaygroundView extends Component {
	private iframe: IFrameElement;
	private errorContainer: DivElement;
	private editor: MonacoEditor;
	private currentFileName: string = "/src/AppPage.ts";
	private files: Record<string, { code: string }>;
	private isCompiling = false;
	private compileTimeout: number | null = null;
	private fileTabs: Map<string, ButtonElement> = new Map();
	// Blob URLs created for the current preview — revoked on next compile run.
	private pendingBlobUrls: string[] = [];

	constructor() {
		super({ className: "flex flex-col overflow-hidden w-full h-full" });
		
		this.files = files;
		
		// Create error container
		this.errorContainer = this.appendChild(new DivElement({
			className: "hidden bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative",
		})) as DivElement;
		this.errorContainer.style.maxHeight = "200px";
		this.errorContainer.style.overflow = "auto";

		// Create main container with split view
		const mainContainer = this.appendChild(new HBox({ 
			className: "flex-1 overflow-hidden"
		})) as HBox;
		
		// Left panel - Editor
		const editorPanel = mainContainer.appendChild(new VBox({
			className: "flex-1 flex flex-col border-r border-gray-300 overflow-hidden"
		})) as VBox;
		
		// File tabs
		const tabsContainer = editorPanel.appendChild(new HBox({
			className: "flex gap-1 p-2 bg-gray-100 border-b border-gray-300 overflow-x-auto"
		})) as HBox;
		
		// Create tabs for editable files
		const editableFiles = ["/src/main.ts", "/src/AppPage.ts"];
		editableFiles.forEach(fileName => {
			const tab = tabsContainer.appendChild(new ButtonElement({
				innerText: fileName.split("/").pop() || fileName,
				className: fileName === this.currentFileName 
					? "px-3 py-1 text-sm bg-white border border-gray-300 rounded cursor-pointer"
					: "px-3 py-1 text-sm bg-gray-200 border border-gray-300 rounded cursor-pointer hover:bg-gray-300"
			})) as ButtonElement;
			
			tab.onclick = () => this.switchFile(fileName);
			this.fileTabs.set(fileName, tab);
		});
		
		// Monaco Editor
		this.editor = editorPanel.appendChild(new MonacoEditor({
			value: this.files[this.currentFileName].code,
			language: "typescript",
			onChange: (value) => this.onEditorChange(value),
			className: "flex-1"
		})) as MonacoEditor;
		
		// Right panel - Preview
		const previewPanel = mainContainer.appendChild(new VBox({
			className: "flex-1 flex flex-col overflow-hidden"
		})) as VBox;
		
		// Preview header
		previewPanel.appendChild(new DivElement({
			innerText: "Preview",
			className: "px-4 py-2 bg-gray-100 border-b border-gray-300 font-semibold text-sm"
		}));
		
		// Create iframe for preview.
		// sandbox="allow-scripts" prevents user code from accessing window.parent/opener
		// of the docs page while still allowing ES module scripts to execute.
		// allow-same-origin is intentionally omitted: the iframe is loaded from a
		// blob: URL (opaque origin) so omitting it strengthens the sandbox.
		this.iframe = previewPanel.appendChild(new IFrameElement({ 
			className: "flex-1",
		})) as IFrameElement;
		this.iframe.style.border = "none";
		this.iframe.setAttribute("sandbox", "allow-scripts");
	}

	async onInit() {
		// Initialize esbuild
		await initializeEsbuild();
		
		// Compile and run the code
		await this.compileAndRun(files);
	}

	/**
	 * Compile files and inject into iframe
	 */
	async compileAndRun(files: Record<string, { code: string }>) {
		if (this.isCompiling) return;
		
		this.isCompiling = true;
		this.hideError();
		// Revoke any blob URLs from the previous compile run to avoid memory leaks.
		this.revokePendingBlobs();

		try {
			const result = await compileFiles(files);

			if (!result.success) {
				this.showError(`Compilation Error:\n${result.error}`);
				this.isCompiling = false;
				return;
			}

			// Create HTML to inject into iframe
			const html = this.createIframeHTML(result.code);

			// Inject into iframe
			await this.injectCode(html);

		} catch (error) {
			this.showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			this.isCompiling = false;
		}
	}

	/**
	 * Create HTML document for iframe.
	 *
	 * The import map resolves bare "typecomposer" specifiers to esm.sh CDN.
	 * The compiled user code is a separate blob: URL dynamically imported from
	 * within this document — import maps in blob: documents apply to dynamic
	 * imports of other blob: URLs in modern browsers (Chrome 89+, Firefox 108+).
	 */
	private createIframeHTML(compiledCode: string): string {
		const typecomposerUrl = `https://esm.sh/typecomposer@${TYPECOMPOSER_VERSION}`;

		// Create a blob URL for the compiled JS. Stored in pendingBlobUrls and
		// revoked at the start of the next compile run.
		const codeBlob = new Blob([compiledCode], { type: 'text/javascript' });
		const codeUrl = URL.createObjectURL(codeBlob);
		this.pendingBlobUrls.push(codeUrl);
		
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TypeComposer Preview</title>
  <script type="importmap">
  {
    "imports": {
      "typecomposer": "${typecomposerUrl}"
    }
  }
  </script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      overflow: auto;
    }
    #app {
      min-height: 100vh;
    }
  </style>
</head>
<body>
  <script>
    // Global error handling
    window.addEventListener("error", (event) => {
      console.error("Runtime Error:", event.error);
      event.preventDefault();
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = "color: #dc2626; padding: 20px; font-family: monospace; white-space: pre-wrap; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; margin: 20px;";
      errorDiv.innerHTML = "<strong>Runtime Error:</strong><br><pre>" + (event.error?.stack || event.message) + "</pre>";
      const appDiv = document.getElementById("app");
      if (appDiv) {
        appDiv.innerHTML = "";
        appDiv.appendChild(errorDiv);
      } else {
        document.body.appendChild(errorDiv);
      }
    });
    
    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled Promise Rejection:", event.reason);
      event.preventDefault();
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = "color: #dc2626; padding: 20px; font-family: monospace; white-space: pre-wrap; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; margin: 20px;";
      errorDiv.innerHTML = "<strong>Unhandled Promise:</strong><br><pre>" + (event.reason?.stack || event.reason) + "</pre>";
      const appDiv = document.getElementById("app");
      if (appDiv) {
        appDiv.appendChild(errorDiv);
      } else {
        document.body.appendChild(errorDiv);
      }
    });
  </script>
  
  <script type="module">
    try {
      await import('${codeUrl}');
    } catch (error) {
      console.error('[Playground] Initialization failed:', error);
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = 'color: #dc2626; padding: 20px; font-family: monospace; white-space: pre-wrap; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; margin: 20px;';
      errorDiv.innerHTML = '<strong>Initialization Error:</strong><br><pre>' + (error.stack || error.message || error) + '</pre>';
      document.body.appendChild(errorDiv);
    }
  </script>
</body>
</html>`;
		return html;
	}

	/**
	 * Inject HTML into iframe via a blob URL.
	 */
	private async injectCode(html: string): Promise<void> {
		return new Promise((resolve) => {
			const blob = new Blob([html], { type: 'text/html' });
			const url = URL.createObjectURL(blob);
			
			this.iframe.src = url;
			
			this.iframe.onload = () => {
				// The HTML blob has been parsed — safe to revoke.
				URL.revokeObjectURL(url);
				setTimeout(() => resolve(), 100);
			};
			
			// Fallback in case onload doesn't fire
			setTimeout(() => resolve(), 500);
		});
	}

	/**
	 * Revoke all pending blob URLs from the previous compile run.
	 */
	private revokePendingBlobs(): void {
		for (const url of this.pendingBlobUrls) {
			URL.revokeObjectURL(url);
		}
		this.pendingBlobUrls = [];
	}

	/**
	 * Show compilation/runtime error
	 */
	private showError(message: string): void {
		this.errorContainer.innerText = message;
		this.errorContainer.className = "bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded relative mb-2";
		this.errorContainer.style.maxHeight = "200px";
		this.errorContainer.style.overflow = "auto";
	}

	/**
	 * Hide error message
	 */
	private hideError(): void {
		this.errorContainer.className = "hidden";
		this.errorContainer.innerText = "";
	}

	/**
	 * Handle editor content changes with debounced compilation
	 */
	private onEditorChange(value: string): void {
		this.files[this.currentFileName].code = value;
		
		if (this.compileTimeout !== null) {
			clearTimeout(this.compileTimeout);
		}
		
		this.compileTimeout = setTimeout(() => {
			this.compileAndRun(this.files);
		}, 1000) as unknown as number;
	}
	
	/**
	 * Switch between files in the editor
	 */
	private switchFile(fileName: string): void {
		if (fileName === this.currentFileName) return;
		
		this.currentFileName = fileName;
		this.editor.setValue(this.files[fileName].code);
		
		this.fileTabs.forEach((tab, name) => {
			if (name === fileName) {
				tab.className = "px-3 py-1 text-sm bg-white border border-gray-300 rounded cursor-pointer";
			} else {
				tab.className = "px-3 py-1 text-sm bg-gray-200 border border-gray-300 rounded cursor-pointer hover:bg-gray-300";
			}
		});
	}

	/**
	 * Public method to update files and recompile
	 */
	public async updateFiles(newFiles: Record<string, { code: string }>): Promise<void> {
		this.files = newFiles;
		this.editor.setValue(this.files[this.currentFileName].code);
		await this.compileAndRun(newFiles);
	}

	/**
	 * Cleanup when component is removed from the DOM.
	 */
	disconnectedCallback() {
		if (this.compileTimeout !== null) {
			clearTimeout(this.compileTimeout);
		}
		this.revokePendingBlobs();
	}
}