import { Fragment, useCallback, useMemo, useState } from "react";
import sanitizeHtml from "sanitize-html";
import { cn } from "../../utils/bem";
import { copyText } from "../../utils/helpers";
import { Button } from "@humansignal/ui";
import { Space } from "../Space/Space";
import "./Error.scss";

export const ErrorWrapper = ({
  title,
  message,
  errorId,
  stacktrace,
  validation,
  version,
  onGoBack,
  onReload,
  possum = false,
  minimal = false,
}) => {
  const preparedStackTrace = useMemo(() => {
    return (stacktrace ?? "").trim();
  }, [stacktrace]);

  const [copied, setCopied] = useState(false);

  const copyStacktrace = useCallback(() => {
    setCopied(true);
    copyText(preparedStackTrace);
    setTimeout(() => setCopied(false), 1200);
  }, [preparedStackTrace]);

  return (
    <div className={cn("error-message").toClassName()}>
      {!minimal && possum !== false && (
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--color-negative-surface, #fef2f2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-negative-content, #ef4444)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <title>Error</title>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      )}

      {!minimal && title && <div className={cn("error-message").elem("title").toClassName()}>{title}</div>}

      {!minimal && message && (
        <div
          className={cn("error-message").elem("detail").toClassName()}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(String(message)),
          }}
        />
      )}

      {!minimal && preparedStackTrace && (
        <div
          className={cn("error-message").elem("stracktrace").toClassName()}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(preparedStackTrace.replace(/(\n)/g, "<br>")),
          }}
        />
      )}

      {validation?.length > 0 && (
        <ul className={cn("error-message").elem("validation").toClassName()}>
          {validation.map(([field, errors]) => (
            <Fragment key={field}>
              {[].concat(errors).map((err, i) => (
                <li
                  key={i}
                  className={cn("error-message").elem("message").toClassName()}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(err) }}
                />
              ))}
            </Fragment>
          ))}
        </ul>
      )}

      {!minimal && (version || errorId) && (
        <div className={cn("error-message").elem("version").toClassName()}>
          <Space>
            {version && `Version: ${version}`}
            {errorId && `Error ID: ${errorId}`}
          </Space>
        </div>
      )}

      {!minimal && (
        <div className={cn("error-message").elem("actions").toClassName()}>
          <Space spread>
            <Space size="small">
              {preparedStackTrace && (
                <Button
                  disabled={copied}
                  onClick={copyStacktrace}
                  className="w-[100px]"
                  aria-label="Copy error stacktrace"
                >
                  {copied ? "Copied" : "Copy Stacktrace"}
                </Button>
              )}
              {onGoBack && (
                <Button onClick={onGoBack} aria-label="Go back">
                  Go Back
                </Button>
              )}
              {onReload && (
                <Button onClick={onReload} aria-label="Reload page">
                  Reload
                </Button>
              )}
            </Space>
          </Space>
        </div>
      )}
    </div>
  );
};
