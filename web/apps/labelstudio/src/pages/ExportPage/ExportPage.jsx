import { useEffect, useRef, useState, useCallback } from "react";
import { useHistory } from "react-router";
import { Button } from "@humansignal/ui";
import {
  IconWarningCircleFilled,
  IconTerminal,
  IconCode,
  IconBook,
  IconExternal,
  IconCopyOutline,
  IconChevronDown,
} from "@humansignal/icons";
import { Form, Input } from "../../components/Form";
import { Modal } from "../../components/Modal/Modal";
import { Space } from "../../components/Space/Space";
import { useAPI } from "../../providers/ApiProvider";
import { useFixedLocation, useParams } from "../../providers/RoutesProvider";
import { cn } from "../../utils/bem";
import { isDefined, copyText } from "../../utils/helpers";
import "./ExportPage.scss";

// Community Edition exports run synchronously in a single HTTP request.
// Large exports can exceed typical proxy timeouts, so we warn early and link to alternatives.
const LARGE_EXPORT_TASK_THRESHOLD = 1000;
const EXPORT_TIMEOUT_DOCS_URL = "https://labelstud.io/guide/export.html#Export-timeout-in-Community-Edition";
const EXPORT_CONSOLE_DOCS_URL = "https://labelstud.io/guide/export.html#Export-using-console-command";
const EXPORT_SNAPSHOT_SDK_URL = "https://api.labelstud.io/api-reference/api-reference/projects/exports/create";
const ENTERPRISE_URL = "https://docs.humansignal.com/guide/label_studio_compare";

// const formats = {
//   json: 'JSON',
//   csv: 'CSV',
// };

const downloadFile = (blob, filename) => {
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const wait = () => new Promise((resolve) => setTimeout(resolve, 5000));

const isTimeoutLikeStatus = (status) => status === 408 || status === 502 || status === 504;

export const ExportPage = () => {
  const history = useHistory();
  const location = useFixedLocation();
  const pageParams = useParams();
  const api = useAPI();

  const [previousExports, setPreviousExports] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadingMessage, setDownloadingMessage] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [currentFormat, setCurrentFormat] = useState("JSON");
  const [projectTaskNumber, setProjectTaskNumber] = useState(null);
  const [exportIssue, setExportIssue] = useState(null);

  /** @type {import('react').RefObject<Form>} */
  const form = useRef();

  const proceedExport = async () => {
    setExportIssue(null);
    setDownloading(true);

    const messageTimer = window.setTimeout(() => {
      setDownloadingMessage(true);
    }, 1000);

    try {
      const params = form.current.assembleFormData({
        asJSON: true,
        full: true,
        booleansAsNumbers: true,
      });

      const response = await api.callApi("exportRaw", {
        params: {
          pk: pageParams.id,
          ...params,
        },
      });

      // The API proxy can return `null` for certain network errors; treat it as timeout-like
      // and show actionable guidance instead of a generic error.
      if (!response) {
        setExportIssue("timeout");
        return;
      }

      if (response.ok) {
        const blob = await response.blob();

        downloadFile(blob, response.headers.get("filename"));
        return;
      }

      if (isTimeoutLikeStatus(response.status)) {
        setExportIssue("timeout");
        return;
      }

      api.handleError(response);
    } finally {
      window.clearTimeout(messageTimer);
      setDownloading(false);
      setDownloadingMessage(false);
    }
  };

  useEffect(() => {
    if (isDefined(pageParams.id)) {
      let cancelled = false;

      api
        .callApi("previousExports", {
          params: {
            pk: pageParams.id,
          },
        })
        .then(({ export_files }) => {
          if (!cancelled) setPreviousExports(export_files.slice(0, 1));
        });

      api
        .callApi("exportFormats", {
          params: {
            pk: pageParams.id,
          },
        })
        .then((formats) => {
          if (cancelled) return;
          setAvailableFormats(formats);
          setCurrentFormat(formats[0]?.name);
        });

      // Fetch project metadata to show a proactive warning for large exports.
      // This is best-effort and should not trigger global error UI if it fails.
      api
        .callApi("project", {
          params: { pk: pageParams.id },
          errorFilter: () => true,
        })
        .then((project) => {
          if (cancelled) return;
          setProjectTaskNumber(project?.task_number ?? null);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [pageParams.id]);

  return (
    <Modal
      onHide={() => {
        const path = location.pathname.replace(ExportPage.path, "");
        const search = location.search;

        history.replace(`${path}${search !== "?" ? search : ""}`);
      }}
      title="Export data"
      style={{ width: 720 }}
      closeOnClickOutside={false}
      allowClose={!downloading}
      // footer="Read more about supported export formats in the Documentation."
      visible
    >
      <div className={cn("export-page").toClassName()}>
        <FormatInfo
          availableFormats={availableFormats}
          selected={currentFormat}
          onClick={(format) => setCurrentFormat(format.name)}
        />

        <ExportLargeProjectWarning taskCount={projectTaskNumber} projectId={pageParams.id} exportType={currentFormat} />
        {exportIssue === "timeout" && <ExportTimeoutGuidance projectId={pageParams.id} exportType={currentFormat} />}

        <Form ref={form}>
          <Input type="hidden" name="exportType" value={currentFormat} />
        </Form>

        <div className={cn("export-page").elem("footer").toClassName()}>
          {downloadingMessage && (
            <div className={cn("export-page").elem("status-message").toClassName()}>
              Files are being prepared. It might take long time.
            </div>
          )}
          <Space style={{ width: "100%" }} spread>
            <div className={cn("export-page").elem("recent").toClassName()}>
              <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
                Having a timeout or trouble exporting large projects?
              </a>
            </div>
            <div className={cn("export-page").elem("actions").toClassName()}>
              <Button className="w-[135px]" onClick={proceedExport} waiting={downloading} aria-label="Export data">
                Export
              </Button>
            </div>
          </Space>
        </div>
      </div>
    </Modal>
  );
};

const FormatInfo = ({ availableFormats, selected, onClick }) => {
  return (
    <div className={cn("formats").toClassName()}>
      <div className={cn("formats").elem("info").toClassName()}>
        You can export dataset in one of the following formats:
      </div>
      <div className={cn("formats").elem("list").toClassName()}>
        {availableFormats.map((format) => (
          <div
            key={format.name}
            className={cn("formats")
              .elem("item")
              .mod({
                active: !format.disabled,
                selected: format.name === selected,
              })
              .toClassName()}
            onClick={!format.disabled ? () => onClick(format) : null}
          >
            <div className={cn("formats").elem("name").toClassName()}>
              {format.title}

              <Space size="small">
                {format.tags?.map?.((tag, index) => (
                  <div key={index} className={cn("formats").elem("tag").toClassName()}>
                    {tag}
                  </div>
                ))}
              </Space>
            </div>

            {format.description && (
              <div className={cn("formats").elem("description").toClassName()}>{format.description}</div>
            )}
          </div>
        ))}
      </div>
      <div className={cn("formats").elem("feedback").toClassName()}>
        Can't find an export format?
        <br />
        Please let us know in{" "}
        <a className="no-go" href="https://slack.labelstud.io/?source=product-export" target="_blank" rel="noreferrer">
          Slack
        </a>{" "}
        or submit an issue to the{" "}
        <a
          className="no-go"
          href="https://github.com/HumanSignal/label-studio-converter/issues"
          target="_blank"
          rel="noreferrer"
        >
          Repository
        </a>
      </div>
    </div>
  );
};

ExportPage.path = "/export";
ExportPage.modal = true;

const ExportLargeProjectWarning = ({ taskCount, projectId, exportType }) => {
  if (!Number.isFinite(taskCount) || taskCount < LARGE_EXPORT_TASK_THRESHOLD) return null;

  return (
    <div className={cn("export-page").elem("warning").toClassName()}>
      <div className={cn("export-page").elem("warning-title").toClassName()}>
        Large project detected ({taskCount.toLocaleString()} tasks)
      </div>
      <div className={cn("export-page").elem("warning-body").toClassName()}>
        Community Edition exports run in your browser session and can time out on very large datasets. Expand the
        recommended options below for CLI or SDK instructions, or consider Label Studio Enterprise for background exports
        at scale.
      </div>
      <RecommendedOptions projectId={projectId} exportType={exportType} collapsible />
    </div>
  );
};

const ExportTimeoutGuidance = ({ projectId, exportType }) => {
  return (
    <div className={cn("export-page").elem("timeout").toClassName()}>
      <div className={cn("export-page").elem("timeout-header").toClassName()}>
        <IconWarningCircleFilled className={cn("export-page").elem("timeout-icon").toClassName()} />
        <div className={cn("export-page").elem("timeout-title").toClassName()}>Export timed out</div>
      </div>
      <div className={cn("export-page").elem("timeout-body").toClassName()}>
        This export is processed synchronously in the Community Edition UI and can exceed typical reverse-proxy timeouts
        (often around 90 seconds) for large datasets.
      </div>

      <RecommendedOptions projectId={projectId} exportType={exportType} />
      <div className={cn("export-page").elem("timeout-footer").toClassName()}>
        <IconBook className={cn("export-page").elem("timeout-footer-icon").toClassName()} />
        <span>
          More details in the documentation:{" "}
          <a className="no-go" href={EXPORT_TIMEOUT_DOCS_URL} target="_blank" rel="noreferrer">
            Export timeout in Community Edition
            <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
          </a>
        </span>
      </div>
    </div>
  );
};

const CollapsibleSection = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("export-page").elem("collapsible").mod({ open }).toClassName()}>
      <button
        type="button"
        className={cn("export-page").elem("collapsible-toggle").toClassName()}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <IconChevronDown className={cn("export-page").elem("collapsible-icon").toClassName()} aria-hidden />
        <span>{title}</span>
      </button>
      {open && <div className={cn("export-page").elem("collapsible-body").toClassName()}>{children}</div>}
    </div>
  );
};

const CopyableCode = ({ code, ariaLabel }) => {
  const [copied, setCopied] = useState(false);
  const normalizedCode = code.trim();

  const handleCopy = useCallback(() => {
    copyText(normalizedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [normalizedCode]);

  return (
    <div className={cn("export-page").elem("code-wrapper").toClassName()}>
      <pre className={cn("export-page").elem("code").toClassName()}>
        <code>{normalizedCode}</code>
      </pre>
      <button
        type="button"
        className={cn("export-page").elem("code-copy-button").toClassName()}
        onClick={handleCopy}
        aria-label={ariaLabel}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        <IconCopyOutline className={cn("export-page").elem("code-copy-icon").toClassName()} />
        {copied && <span className={cn("export-page").elem("code-copy-text").toClassName()}>Copied</span>}
      </button>
    </div>
  );
};

const RecommendedOptions = ({ projectId, exportType, collapsible = false, defaultOpen = false }) => {
  const resolvedExportType = exportType ?? "JSON";
  const cliProjectId = Number.isFinite(projectId) ? projectId : "<project-id>";
  const cliCommand = `label-studio export ${cliProjectId} ${resolvedExportType} --export-path=<output-path>`;
  const pipInstallCommand = "pip install label-studio-sdk";
  const envSnippet = `export LABEL_STUDIO_HOST="https://your-label-studio.example.com"
export LABEL_STUDIO_API_KEY="paste-your-token-here"`;
  const sdkProjectLine = Number.isFinite(projectId)
    ? `PROJECT_ID = ${projectId}`
    : "PROJECT_ID = 123  # TODO: replace with your project ID";
  const sdkCode = `import os
import time
from label_studio_sdk import Client

${sdkProjectLine}
EXPORT_TYPE = "${resolvedExportType}"

ls = Client(
    url=os.environ["LABEL_STUDIO_HOST"],
    api_key=os.environ["LABEL_STUDIO_API_KEY"],
)

project = ls.get_project(PROJECT_ID)
export_job = project.export_snapshot_create(
    export_type=EXPORT_TYPE,
    title="SDK export snapshot",
)
export_id = export_job["id"]

while True:
    status = project.get_export_status(export_id)
    if status["status"] == "completed":
        project.export_snapshot_download(
            export_id,
            export_type=EXPORT_TYPE,
            path=".",
        )
        break
    if status["status"] == "failed":
        raise RuntimeError("Export failed")
    time.sleep(5)

print("Export snapshot downloaded")
`;

  const content = (
    <div className={cn("export-page").elem("recommended").toClassName()}>
      <div className={cn("export-page").elem("timeout-actions").toClassName()}>
        <div className={cn("export-page").elem("timeout-actions-title").toClassName()}>Recommended options:</div>
        <ul className={cn("export-page").elem("timeout-actions-list").toClassName()}>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconTerminal className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                <span>
                  Export using the{" "}
                  <a className="no-go" href={EXPORT_CONSOLE_DOCS_URL} target="_blank" rel="noreferrer">
                    console command
                    <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                  </a>{" "}
                  to run the export directly on the server until it finishes.
                </span>
                <CopyableCode code={cliCommand} ariaLabel="Copy CLI export command" />
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconCode className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                <span>
                  Use{" "}
                  <a className="no-go" href={EXPORT_SNAPSHOT_SDK_URL} target="_blank" rel="noreferrer">
                    export snapshots via the SDK
                    <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                  </a>{" "}
                  to create a snapshot asynchronously instead of relying on a single browser request.
                </span>
                <ol className={cn("export-page").elem("sdk-steps").toClassName()}>
                  <li>
                    <strong>Install the SDK.</strong>
                    <CopyableCode code={pipInstallCommand} ariaLabel="Copy pip install command" />
                  </li>
                  <li>
                    <strong>Grab your API URL & key.</strong> In Label Studio, open your avatar menu →{" "}
                    <em>Account & Settings &gt; Access Token</em> to copy the token. Use your deployment URL (for example,
                    https://labelstudio.mycompany.com) as the host.
                  </li>
                  <li>
                    <strong>Set the environment variables.</strong>
                    <CopyableCode code={envSnippet} ariaLabel="Copy environment variable exports" />
                  </li>
                  <li>
                    <strong>Run the SDK export script.</strong>
                    <CopyableCode code={sdkCode} ariaLabel="Copy SDK export script" />
                  </li>
                </ol>
                <div className={cn("export-page").elem("sdk-note").toClassName()}>
                  SDK snapshots run via your deployment and, while more resilient than the UI, cannot guarantee success
                  for every extremely large dataset.
                </div>
              </div>
            </div>
          </li>
          <li>
            <div className={cn("export-page").elem("timeout-action-item").toClassName()}>
              <IconBook className={cn("export-page").elem("timeout-action-icon").toClassName()} />
              <div className={cn("export-page").elem("timeout-action-content").toClassName()}>
                For large-scale and streamlined data workflows, consider{" "}
                <a className="no-go" href={ENTERPRISE_URL} target="_blank" rel="noreferrer">
                  Label Studio Enterprise
                  <IconExternal className={cn("export-page").elem("timeout-link-icon").toClassName()} />
                </a>{" "}
                which provides asynchronous exports, dedicated workers, and background processing at scale.
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <CollapsibleSection title="Recommended options (CLI or SDK)" defaultOpen={defaultOpen}>
        {content}
      </CollapsibleSection>
    );
  }

  return content;
};
