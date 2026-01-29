import {
  FF_DEV_1752,
  FF_DEV_2186,
  FF_DEV_2887,
  FF_DEV_3034,
  FF_FIT_720_LAZY_LOAD_ANNOTATIONS,
  FF_LSDV_4620_3_ML,
  isFF,
} from "../utils/feature-flags";
import { isDefined } from "../utils/utils";
import { Modal } from "../components/Common/Modal/Modal";
import { CommentsSdk } from "./comments-sdk";
// import { LSFHistory } from "./lsf-history";
import { annotationToServer, taskToLSFormat } from "./lsf-utils";
import { when } from "mobx";

// FIT-720: Import cache invalidation functions
let invalidateAnnotationCache = null;
let invalidateDistributionCache = null;

// Dynamically import from editor to avoid circular dependency
// This is safe because the functions will be available when the app is fully loaded
try {
  const editorHooks = require("@humansignal/editor/src/hooks/useAnnotationQuery");
  invalidateAnnotationCache = editorHooks.invalidateAnnotationCache;
  invalidateDistributionCache = editorHooks.invalidateDistributionCache;
} catch {
  // Editor hooks not available, invalidation will be skipped
  console.debug("[FIT-720] Editor hooks not available for cache invalidation");
}

const DEFAULT_INTERFACES = [
  "basic",
  "controls",
  "submit",
  "update",
  "predictions",
  "topbar",
  "predictions:menu", // right menu with prediction items
  "annotations:menu", // right menu with annotation items
  "annotations:current",
  "side-column", // entity
  "edit-history", // undo/redo
];

let LabelStudioDM;

const resolveLabelStudio = () => {
  if (LabelStudioDM) {
    return LabelStudioDM;
  }
  if (window.LabelStudio) {
    return (LabelStudioDM = window.LabelStudio);
  }
};

// Returns true to suppress (swallow) the error, false to bubble to global handler.
// We allow 403 PAUSED to bubble so the app-level ApiProvider can show the paused modal
const errorHandlerAllowPaused = (result) => {
  const isPaused =
    result?.status === 403 &&
    typeof result?.response === "object" &&
    result?.response?.display_context?.reason === "PAUSED";
  return !isPaused;
};

// Support portal URL constants used to construct error reporting links
// These are used in showOperationToast() to create support links with request IDs
// for better error tracking and customer support
export const SUPPORT_URL = "https://support.humansignal.com/hc/en-us/requests/new";
export const SUPPORT_URL_REQUEST_ID_PARAM = "tf_37934448633869"; // request_id field ID in ZD

export class LSFWrapper {
  /** @type {HTMLElement} */
  root = null;

  /** @type {DataManager} */
  datamanager = null;

  /** @type {Task} */
  task = null;

  /** @type {Annotation} */
  initialAnnotation = null;

  /** @type {LabelStudio} */
  lsf = null;

  /** @type {LSFHistory} */
  // history = null;

  /** @type {boolean} */
  labelStream = false;

  /** @type {boolean} */
  isInteractivePreannotations = false;

  /** @type {function} */
  interfacesModifier = (interfaces) => interfaces;

  /**
   *
   * @param {DataManager} dm
   * @param {HTMLElement} element
   * @param {LSFOptions} options
   */
  constructor(dm, element, options) {
    // we need to pass the rest of the options to LSF below
    const {
      task,
      preload,
      isLabelStream,
      annotation,
      interfacesModifier,
      isInteractivePreannotations,
      user,
      keymap,
      messages,
      ...restOptions
    } = options;

    this.datamanager = dm;
    this.store = dm.store;
    this.root = element;
    this.task = task;
    this.preload = preload;
    this.labelStream = isLabelStream ?? false;
    this.initialAnnotation = annotation;
    this.interfacesModifier = interfacesModifier;
    this.isInteractivePreannotations = isInteractivePreannotations ?? false;

    let interfaces = [...DEFAULT_INTERFACES];

    if (this.project.enable_empty_annotation === false) {
      interfaces.push("annotations:deny-empty");
    }

    if (window.APP_SETTINGS.annotator_reviewer_firewall_enabled && this.labelStream) {
      interfaces.push("annotations:hide-info");
    }

    if (this.labelStream) {
      interfaces.push("infobar");
      if (!window.APP_SETTINGS.label_stream_navigation_disabled) interfaces.push("topbar:prevnext");
      if (FF_DEV_2186 && this.project.review_settings?.require_comment_on_reject) {
        interfaces.push("comments:update");
      }
      if (this.project.show_skip_button) {
        interfaces.push("skip");
      }
    } else {
      interfaces.push(
        "infobar",
        "annotations:add-new",
        "annotations:view-all",
        "annotations:delete",
        "annotations:tabs",
        "predictions:tabs",
        "annotations:copy-link",
      );
    }

    if (this.datamanager.hasInterface("instruction")) {
      interfaces.push("instruction");
    }

    if (!this.labelStream && this.datamanager.hasInterface("groundTruth")) {
      interfaces.push("ground-truth");
    }

    if (this.datamanager.hasInterface("autoAnnotation")) {
      interfaces.push("auto-annotation");
    }

    if (isFF(FF_DEV_2887)) {
      interfaces.push("annotations:comments");
      interfaces.push("comments:resolve-any");
    }

    if (this.project.review_settings?.require_comment_on_reject) {
      interfaces.push("comments:reject");
    }

    if (this.interfacesModifier) {
      interfaces = this.interfacesModifier(interfaces, this.labelStream);
    }

    if (!this.shouldLoadNext()) {
      interfaces = interfaces.filter((item) => {
        return !["topbar:prevnext", "skip"].includes(item);
      });
    }

    const queueTotal = dm.store.project.reviewer_queue_total || dm.store.project.queue_total;
    const queueDone = dm.store.project.queue_done;
    const queueLeft = dm.store.project.queue_left;
    const queuePosition = queueDone ? queueDone + 1 : queueLeft ? queueTotal - queueLeft + 1 : 1;
    const commentClassificationConfig = dm.store.project.comment_classification_config;

    const lsfProperties = {
      user: options.user,
      config: this.lsfConfig,
      task: taskToLSFormat(this.task),
      description: this.instruction,
      interfaces,
      users: dm.store.users.map((u) => u.toJSON()),
      keymap: options.keymap,
      forceAutoAnnotation: this.isInteractivePreannotations,
      forceAutoAcceptSuggestions: this.isInteractivePreannotations,
      messages: options.messages,
      queueTotal,
      queuePosition,
      commentClassificationConfig,

      /* EVENTS */
      onSubmitDraft: this.onSubmitDraft,
      onLabelStudioLoad: this.onLabelStudioLoad,
      onTaskLoad: this.onTaskLoad,
      onPresignUrlForProject: this.onPresignUrlForProject,
      onStorageInitialized: this.onStorageInitialized,
      onSubmitAnnotation: this.onSubmitAnnotation,
      onUpdateAnnotation: this.onUpdateAnnotation,
      onDeleteAnnotation: this.onDeleteAnnotation,
      onSkipTask: this.onSkipTask,
      onUnskipTask: this.onUnskipTask,
      onGroundTruth: this.onGroundTruth,
      onEntityCreate: this.onEntityCreate,
      onEntityDelete: this.onEntityDelete,
      onSelectAnnotation: this.onSelectAnnotation,
      onNextTask: this.onNextTask,
      onPrevTask: this.onPrevTask,

      ...restOptions,
    };

    this.initLabelStudio(lsfProperties);
  }

  /** @private */
  initLabelStudio(settings) {
    try {
      const LSF = resolveLabelStudio();

      this.lsfInstance = new LSF(this.root, settings);

      this.lsfInstance.on("presignUrlForProject", this.onPresignUrlForProject);

      const names = Array.from(this.datamanager.callbacks.keys()).filter((k) => k.startsWith("lsf:"));

      names.forEach((name) => {
        this.datamanager.getEventCallbacks(name).forEach((clb) => {
          this.lsfInstance.on(name.replace(/^lsf:/, ""), clb);
        });
      });

      if (isFF(FF_DEV_2887)) {
        new CommentsSdk(this.lsfInstance, this.datamanager);
      }

      this.datamanager.invoke("lsfInit", this, this.lsfInstance);
    } catch (err) {
      console.error("Failed to initialize LabelStudio", settings);
      console.error(err);
    }
  }

  /** @private */
  async preloadTask() {
    const { comment: commentId, task: taskID } = this.preload;
    const api = this.datamanager.api;
    const params = { taskID };

    if (commentId) {
      params.with_comment = commentId;
    }

    if (params) {
      const task = await api.call("task", { params });
      const noData = !task || (!task.annotations?.length && !task.drafts?.length);
      const body = `Task #${taskID}${commentId ? ` with comment #${commentId}` : ""} was not found!`;

      if (noData) {
        Modal.modal({
          title: "Can't find task",
          body,
        });
        return false;
      }

      // for preload it's good to always load the first one
      const annotation = task.annotations[0];

      this.selectTask(task, annotation?.id, true);
    }

    return false;
  }

  /** @private */
  async loadTask(taskID, annotationID, fromHistory = false) {
    if (!this.lsf) {
      return console.error("Make sure that LSF was properly initialized");
    }

    const nextAction = async () => {
      const tasks = this.datamanager.store.taskStore;

      const newTask = await this.withinLoadingState(async () => {
        let nextTask;

        if (!isDefined(taskID)) {
          nextTask = await tasks.loadNextTask();
        } else {
          nextTask = await tasks.loadTask(taskID);
        }

        /**
         * If we're in label stream and there's no task – end the stream
         * Otherwise allow user to continue exploring tasks after finished labelling
         */
        const noTask = this.labelStream && !nextTask;

        this.lsf.setFlags({ noTask });

        return nextTask;
      });

      // Add new data from received task
      if (newTask) this.selectTask(newTask, annotationID, fromHistory);
    };

    if (isFF(FF_DEV_2887) && this.lsf?.commentStore?.hasUnsaved) {
      Modal.confirm({
        title: "You have unsaved changes",
        body: "There are comments which are not persisted. Please submit the annotation. Continuing will discard these comments.",
        onOk() {
          nextAction();
        },
        okText: "Discard and continue",
      });
      return;
    }

    await nextAction();
  }

  exitStream() {
    this.datamanager.invoke("navigate", "projects");
  }

  selectTask(task, annotationID, fromHistory = false) {
    const needsAnnotationsMerge = task && this.task?.id === task.id;
    const annotations = needsAnnotationsMerge ? [...this.annotations] : [];

    this.task = task;

    if (needsAnnotationsMerge) {
      this.task.mergeAnnotations(annotations);
    }

    this.loadUserLabels();

    this.setLSFTask(task, annotationID, fromHistory);
  }

  async setLSFTask(task, annotationID, fromHistory, selectPrediction = false) {
    if (!this.lsf) return;

    const hasChangedTasks = this.lsf?.task?.id !== task?.id && task?.id;

    this.setLoading(true, hasChangedTasks);
    const lsfTask = taskToLSFormat(task);
    const isRejectedQueue = isDefined(task.default_selected_annotation);
    const taskList = this.datamanager.store.taskStore.list;
    // annotations are set in LSF only and order in DM only, so combine them
    const taskHistory = taskList
      .map((task) => this.taskHistory.find((item) => item.taskId === task.id))
      .filter(Boolean);

    const extracted = taskHistory.find((item) => item.taskId === task.id);

    if (!fromHistory && extracted) {
      taskHistory.splice(taskHistory.indexOf(extracted), 1);
      taskHistory.push(extracted);
    }

    if (!extracted) {
      taskHistory.push({ taskId: task.id, annotationId: null });
    }

    if (isRejectedQueue && !annotationID) {
      annotationID = task.default_selected_annotation;
    }

    if (hasChangedTasks) {
      this.lsf.resetState();
    } else {
      this.lsf.resetAnnotationStore();
    }

    // Initial idea to show counter for Manual assignment only
    // But currently we decided to hide it for any stream
    // const distribution = this.project.assignment_settings.label_stream_task_distribution;
    // const isManuallyAssigned = distribution === "assigned_only";

    // undefined or true for backward compatibility
    this.lsf.toggleInterface("postpone", this.task.allow_postpone !== false);
    this.lsf.toggleInterface("topbar:task-counter", true);
    this.lsf.assignTask(task);
    this.lsf.initializeStore(lsfTask);
    await this.setAnnotation(annotationID, fromHistory || isRejectedQueue, selectPrediction);
    this.setLoading(false);
  }

  /**
   * Ensure annotation is fully loaded (for lazy loading - FIT-720)
   * If the annotation is a stub, fetch the full annotation data from the server.
   * @param {string} annotationPk - The annotation pk to load
   * @returns {Promise<Object|null>} The full annotation data or null if not a stub
   * @private
   */
  async ensureAnnotationLoaded(annotationPk) {
    if (!isFF(FF_FIT_720_LAZY_LOAD_ANNOTATIONS) || !this.labelStream) {
      return null;
    }

    // Check if this annotation is a stub in the original task data
    const taskAnnotation = this.task?.annotations?.find((a) => String(a.id) === String(annotationPk));
    if (!taskAnnotation?.is_stub) {
      console.log(`[FIT-720] LabelStream: Annotation ${annotationPk} is not a stub, skipping lazy load`);
      return null;
    }

    console.log(`[FIT-720] LabelStream: Annotation ${annotationPk} is a stub, loading full data...`);

    // Fetch full annotation from backend
    try {
      const taskStore = this.datamanager.store.taskStore;
      const fullAnnotation = await taskStore.loadAnnotation(annotationPk);

      if (fullAnnotation && !fullAnnotation.error) {
        // Update the original task annotation data
        const annotationIndex = this.task.annotations.findIndex((a) => String(a.id) === String(annotationPk));
        if (annotationIndex !== -1) {
          // Merge full annotation data, removing stub flag
          this.task.annotations[annotationIndex] = {
            ...this.task.annotations[annotationIndex],
            ...fullAnnotation,
            is_stub: false,
          };
        }

        // Hydrate the LSF annotation with the full result
        const lsfAnnotation = this.annotations.find((a) => String(a.pk) === String(annotationPk));
        if (lsfAnnotation && fullAnnotation.result) {
          console.log(
            `[FIT-720] LabelStream: Hydrating annotation ${annotationPk} with ${fullAnnotation.result?.length || 0} regions`,
          );
          lsfAnnotation.history.freeze();
          lsfAnnotation.deserializeResults(fullAnnotation.result);
          // Critical: updateObjects() is required to render visual regions after deserializing
          lsfAnnotation.updateObjects();
          lsfAnnotation.history.safeUnfreeze();
          lsfAnnotation.history.reinit();
        }

        return fullAnnotation;
      }
    } catch (error) {
      console.error(`[FIT-720] LabelStream: Failed to load annotation ${annotationPk}:`, error);
    }

    return null;
  }

  /** @private */
  async setAnnotation(annotationID, selectAnnotation = false, selectPrediction = false) {
    const id = annotationID ? annotationID.toString() : null;
    const { annotationStore: cs } = this.lsf;
    let annotation;
    const activeDrafts = cs.annotations.map((a) => a.draftId).filter(Boolean);

    if (this.task.drafts) {
      for (const draft of this.task.drafts) {
        if (activeDrafts.includes(draft.id)) continue;
        let c;

        if (draft.annotation) {
          // Annotation existed - add draft to existed annotation
          const draftAnnotationPk = String(draft.annotation);

          c = cs.annotations.find((c) => c.pk === draftAnnotationPk);
          if (c) {
            c.history.freeze();
            c.addVersions({ draft: draft.result });
            c.deleteAllRegions({ deleteReadOnly: true });
          } else {
            // that shouldn't happen
            console.error(`No annotation found for pk=${draftAnnotationPk}`);
            continue;
          }
        } else {
          // Annotation not found - restore annotation from draft
          c = cs.addAnnotation({
            draft: draft.result,
            userGenerate: true,
            comment_count: draft.comment_count,
            unresolved_comment_count: draft.unresolved_comment_count,
            createdBy: draft.created_username,
            createdAgo: draft.created_ago,
            createdDate: draft.created_at,
          });
        }
        cs.selectAnnotation(c.id);
        c.deserializeResults(draft.result);
        c.setDraftId(draft.id);
        c.setDraftSaved(draft.created_at);
        c.history.safeUnfreeze();
        c.history.reinit();
      }
    }
    const first = this.annotations?.length ? this.annotations[0] : null;
    // if we have annotations created automatically, we don't need to create another one
    // automatically === created here and haven't saved yet, so they don't have pk
    // @todo because of some weird reason pk may be string uid, so check flags then
    const hasAutoAnnotations = !!first && (!first.pk || (first.userGenerate && first.sentUserGenerate === false));
    const showPredictions = this.project.show_collab_predictions === true;

    if (this.labelStream) {
      if (first?.draftId) {
        // not submitted draft, most likely from previous labeling session
        annotation = first;
      } else if (isDefined(annotationID) && selectAnnotation) {
        // Lazy load annotation if it's a stub (FIT-720)
        await this.ensureAnnotationLoaded(annotationID);
        annotation = this.annotations.find(({ pk }) => pk === annotationID);
      } else if (showPredictions && this.predictions.length > 0 && !this.isInteractivePreannotations) {
        annotation = cs.addAnnotationFromPrediction(this.predictions[0]);
      } else {
        annotation = cs.createAnnotation();
      }
    } else {
      if (selectPrediction) {
        annotation = this.predictions.find((p) => p.pk === id);
        annotation ??= first; // if prediction not found, select first annotation and resume existing behaviour
      } else if (this.annotations.length === 0 && this.predictions.length > 0 && !this.isInteractivePreannotations) {
        const predictionByModelVersion = this.predictions.find((p) => p.createdBy === this.project.model_version);
        annotation = cs.addAnnotationFromPrediction(predictionByModelVersion ?? this.predictions[0]);
      } else if (this.annotations.length > 0 && id && id !== "auto") {
        annotation = this.annotations.find((c) => c.pk === id || c.id === id);
      } else if (this.annotations.length > 0 && (id === "auto" || hasAutoAnnotations)) {
        annotation = first;
      } else {
        annotation = cs.createAnnotation();
      }
    }

    if (annotation) {
      // We want to be sure this is explicitly understood to be a prediction and the
      // user wants to select it directly
      if (selectPrediction && annotation.type === "prediction") {
        cs.selectPrediction(annotation.id);
      } else {
        // Otherwise we default the behaviour to being as was before
        cs.selectAnnotation(annotation.id);
      }
      this.datamanager.invoke("annotationSet", annotation);
    }
  }

  saveUserLabels = async () => {
    const body = [];
    const userLabels = this.lsf?.userLabels?.controls;

    if (!userLabels) return;

    for (const from_name in userLabels) {
      for (const label of userLabels[from_name]) {
        body.push({
          value: label.path,
          title: [from_name, JSON.stringify(label.path)].join(":"),
          from_name,
          project: this.project.id,
        });
      }
    }

    if (!body.length) return;

    await this.datamanager.apiCall("saveUserLabels", {}, { body });
  };

  async loadUserLabels() {
    if (!this.lsf?.userLabels) return;

    const userLabels = await this.datamanager.apiCall("userLabelsForProject", {
      project: this.project.id,
      expand: "label",
    });

    if (!userLabels) return;

    const controls = {};

    for (const result of userLabels.results ?? []) {
      // don't trust server's response!
      if (!result?.label?.value?.length) continue;

      const control = result.from_name;

      if (!controls[control]) controls[control] = [];
      controls[control].push(result.label.value);
    }

    this.lsf.userLabels.init(controls);
  }

  onLabelStudioLoad = async (ls) => {
    this.datamanager.invoke("labelStudioLoad", ls);
    this.lsf = ls;

    if (!this.lsf.task) this.setLoading(true);

    const _taskHistory = await this.datamanager.store.taskStore.loadTaskHistory({
      projectId: this.datamanager.store.project.id,
    });

    this.lsf.setTaskHistory(_taskHistory);

    await this.loadUserLabels();

    if (this.canPreloadTask && isFF(FF_DEV_1752)) {
      await this.preloadTask();
    } else if (this.labelStream) {
      await this.loadTask();
    }

    this.setLoading(false);
  };

  /** @private */
  onTaskLoad = async (...args) => {
    this.datamanager.invoke("onSelectAnnotation", ...args);
  };

  /**
   * Proxy urls to presign them if storage is connected
   * @param {*} _ LS instance
   * @param {string} url http/https are not proxied and returned as is
   */
  onPresignUrlForProject = (_, url) => {
    // if URL is a relative, presigned url (url matches /tasks|projects/:id/resolve/.*) make it absolute
    const presignedUrlPattern = /^\/(?:tasks|projects)\/\d+\/resolve\/?/;
    if (presignedUrlPattern.test(url)) {
      url = new URL(url, document.location.origin).toString();
    }

    const parsedUrl = new URL(url);

    // return same url if http(s)
    if (["http:", "https:"].includes(parsedUrl.protocol)) return url;

    const api = this.datamanager.api;
    const projectId = this.project.id;
    const fileuri = btoa(url);

    return api.createUrl(api.endpoints.presignUrlForProject, { projectId, fileuri }).url;
  };

  onStorageInitialized = async (ls) => {
    this.datamanager.invoke("onStorageInitialized", ls);

    if (this.task && this.labelStream === false) {
      const annotationID =
        this.initialAnnotation?.pk ?? this.task.lastAnnotation?.pk ?? this.task.lastAnnotation?.id ?? "auto";

      await this.setAnnotation(annotationID);
    }
  };

  /** @private */
  showOperationToast(status, successMessage, errorAction, result) {
    if (status === 200 || status === 201) {
      this.datamanager.invoke("toast", { message: successMessage, type: "info" });
    } else if (status !== undefined) {
      const requestId = result?.$meta?.headers?.get("x-ls-request-id");
      const supportUrl = requestId ? `${SUPPORT_URL}?${SUPPORT_URL_REQUEST_ID_PARAM}=${requestId}` : SUPPORT_URL;

      this.datamanager.invoke("toast", {
        message: (
          <span>
            {errorAction}, please try again or{" "}
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline" }}
              onClick={(e) => e.stopPropagation()}
            >
              contact our team
            </a>{" "}
            if it doesn't help.
          </span>
        ),
        type: "error",
      });
    }
  }

  /** @private */
  onSubmitAnnotation = async () => {
    const exitStream = this.shouldExitStream();
    const loadNext = exitStream ? false : this.shouldLoadNext();
    const result = await this.submitCurrentAnnotation(
      "submitAnnotation",
      async (taskID, body) => {
        return await this.datamanager.apiCall(
          "submitAnnotation",
          { taskID },
          { body },
          // errors are displayed by "toast" event - we don't want to show blocking modal
          { errorHandler: errorHandlerAllowPaused },
        );
      },
      false,
      loadNext,
    );
    const status = result?.$meta?.status;

    this.showOperationToast(status, "Annotation saved successfully", "Annotation is not saved", result);

    // FIT-720: Invalidate caches after successful submit
    if (status < 400) {
      // Invalidate specific annotation if ID is in result
      if (result?.id) {
        invalidateAnnotationCache?.(result.id);
      }
      // Invalidate distribution for the task
      invalidateDistributionCache?.(this.task?.id);
    }

    if (exitStream) return this.exitStream();
  };

  /** @private */
  onUpdateAnnotation = async (ls, annotation, extraData) => {
    const { task } = this;
    const serializedAnnotation = this.prepareData(annotation);
    const exitStream = this.shouldExitStream();

    Object.assign(serializedAnnotation, extraData);

    await this.saveUserLabels();

    const result = await this.withinLoadingState(async () => {
      return this.datamanager.apiCall(
        "updateAnnotation",
        {
          taskID: task.id,
          annotationID: annotation.pk,
        },
        {
          body: serializedAnnotation,
        },
        // errors are displayed by "toast" event - we don't want to show blocking modal
        { errorHandler: errorHandlerAllowPaused },
      );
    });
    const status = result?.$meta?.status;

    this.showOperationToast(status, "Annotation updated successfully", "Annotation is not updated", result);

    this.datamanager.invoke("updateAnnotation", ls, annotation, result);

    // FIT-720: Invalidate annotation cache after successful update
    if (status < 400 && annotation.pk) {
      invalidateAnnotationCache?.(annotation.pk);
      invalidateDistributionCache?.(task.id);
    }

    if (exitStream) return this.exitStream();

    if (status >= 400) {
      return;
    }

    const isRejectedQueue = isDefined(task.default_selected_annotation);

    if (isRejectedQueue) {
      // load next task if that one was updated task from rejected queue
      await this.loadTask();
    } else {
      await this.loadTask(this.task.id, annotation.pk, true);
    }
  };

  deleteDraft = async (id) => {
    const response = await this.datamanager.apiCall("deleteDraft", {
      draftID: id,
    });

    this.task.deleteDraft(id);
    return response;
  };

  /**@private */
  onDeleteAnnotation = async (ls, annotation) => {
    const { task } = this;
    let response;

    task.deleteAnnotation(annotation);

    if (annotation.userGenerate && annotation.sentUserGenerate === false) {
      if (annotation.draftId) {
        response = await this.deleteDraft(annotation.draftId);
      } else {
        response = { ok: true };
      }
    } else {
      response = await this.withinLoadingState(async () => {
        return this.datamanager.apiCall("deleteAnnotation", {
          taskID: task.id,
          annotationID: annotation.pk,
        });
      });

      // this.task.deleteAnnotation(annotation);
      this.datamanager.invoke("deleteAnnotation", ls, annotation);
    }

    if (response.ok) {
      const lastAnnotation = this.annotations[this.annotations.length - 1] ?? {};
      const annotationID = lastAnnotation.pk ?? undefined;

      await this.setAnnotation(annotationID);
    }
  };

  draftToast = (status, result = null) => {
    this.showOperationToast(status, "Draft saved successfully", "Draft is not saved", result);
  };

  needsDraftSave = (annotation) => {
    if (annotation.history?.hasChanges && !annotation.draftSaved) return true;
    if (
      annotation.history?.hasChanges &&
      new Date(annotation.history.lastAdditionTime) > new Date(annotation.draftSaved)
    )
      return true;
    return false;
  };

  saveDraft = async (target = null) => {
    const selected = target || this.lsf?.annotationStore?.selected;
    const hasChanges = selected ? this.needsDraftSave(selected) : false;

    if (selected?.isDraftSaving) {
      await when(() => !selected.isDraftSaving);
      this.draftToast(200);
    } else if (hasChanges && selected) {
      const res = await selected?.saveDraftImmediatelyWithResults();

      this.draftToast(res.$meta?.status, res);
    }
  };

  onSubmitDraft = async (_studio, annotation, params = {}) => {
    // It should be preserved as soon as possible because each `await` will allow it to be changed
    const taskId = this.task.id;
    const annotationDoesntExist = !annotation.pk;
    const data = { body: this.prepareData(annotation, { isNewDraft: true }) }; // serializedAnnotation
    const hasChanges = this.needsDraftSave(annotation);
    const showToast = params?.useToast && hasChanges;
    // console.log('onSubmitDraft', params?.useToast, hasChanges);

    if (params?.useToast) delete params.useToast;

    Object.assign(data.body, params);

    await this.saveUserLabels();

    if (annotation.draftId > 0) {
      // draft has been already created
      const res = await this.datamanager.apiCall("updateDraft", { draftID: annotation.draftId }, data);

      showToast && this.draftToast(res.$meta?.status, res);
      this.datamanager.invoke("submitDraft", this, annotation, res);
      return res;
    }
    let response;

    if (annotationDoesntExist) {
      response = await this.datamanager.apiCall("createDraftForTask", { taskID: taskId }, data);
    } else {
      response = await this.datamanager.apiCall(
        "createDraftForAnnotation",
        { taskID: taskId, annotationID: annotation.pk },
        data,
      );
    }
    response?.id && annotation.setDraftId(response?.id);
    showToast && this.draftToast(response.$meta?.status, response);
    this.datamanager.invoke("submitDraft", this, annotation, response);

    return response;
  };

  onSkipTask = async (_, { comment } = {}) => {
    // Manager roles that can force-skip unskippable tasks (OW=Owner, AD=Admin, MA=Manager)
    const MANAGER_ROLES = ["OW", "AD", "MA"];
    const task = this.task;
    const isEnterprise = window.APP_SETTINGS?.billing?.enterprise;
    const skipDisabled = isEnterprise ? task?.allow_skip === false : false;
    const userRole = window.APP_SETTINGS?.user?.role;
    const hasForceSkipPermission = MANAGER_ROLES.includes(userRole);
    const canSkip = !skipDisabled || hasForceSkipPermission;
    if (!canSkip) {
      console.warn("Task cannot be skipped: allow_skip is false and user lacks manager role");
      this.showOperationToast(400, null, "This task cannot be skipped", { error: "Task cannot be skipped" });
      return;
    }
    const result = await this.submitCurrentAnnotation(
      "skipTask",
      async (taskID, body) => {
        const { id, ...annotation } = body;
        const params = { taskID };
        const options = { body: { ...annotation, was_cancelled: true } };

        if (comment) options.body.comment = comment;

        if (id !== undefined) params.annotationID = id;

        return await this.datamanager.apiCall(
          id === undefined ? "submitAnnotation" : "updateAnnotation",
          params,
          options,
          { errorHandler: errorHandlerAllowPaused },
        );
      },
      true,
      this.shouldLoadNext(),
    );
    const status = result?.$meta?.status;

    this.showOperationToast(status, "Task skipped successfully", "Task is not skipped", result);
  };

  onUnskipTask = async () => {
    const { task, currentAnnotation } = this;

    if (!isDefined(currentAnnotation) && !isDefined(currentAnnotation.pk)) {
      console.error("Annotation must be on unskip");
      return;
    }

    await this.withinLoadingState(async () => {
      currentAnnotation.pauseAutosave();

      if (isFF(FF_DEV_3034)) {
        await this.datamanager.apiCall("convertToDraft", {
          annotationID: currentAnnotation.pk,
        });
      } else {
        if (currentAnnotation.draftId > 0) {
          await this.datamanager.apiCall(
            "updateDraft",
            {
              draftID: currentAnnotation.draftId,
            },
            {
              body: { annotation: null },
            },
          );
        } else {
          const annotationData = { body: this.prepareData(currentAnnotation) };

          await this.datamanager.apiCall(
            "createDraftForTask",
            {
              taskID: this.task.id,
            },
            annotationData,
          );
        }

        // Carry over any comments to when the annotation draft is eventually submitted
        if (isFF(FF_DEV_2887) && this.lsf?.commentStore?.toCache) {
          this.lsf.commentStore.toCache(`task.${task.id}`);
        }

        await this.datamanager.apiCall("deleteAnnotation", {
          taskID: task.id,
          annotationID: currentAnnotation.pk,
        });
      }
    });
    await this.loadTask(task.id);
    this.datamanager.invoke("unskipTask");
  };

  shouldLoadNext = () => {
    if (!this.labelStream) return false;

    // validating if URL is from notification, in case of notification it shouldn't load next task
    const urlParam = new URLSearchParams(location.search).get("interaction");

    return urlParam !== "notifications";
  };

  shouldExitStream = () => {
    const paramName = "exitStream";
    const urlParam = new URLSearchParams(location.search).get(paramName);
    const searchParams = new URLSearchParams(window.location.search);

    searchParams.delete(paramName);
    let newRelativePathQuery = window.location.pathname;

    if (searchParams.toString()) newRelativePathQuery += `?${searchParams.toString()}`;
    window.history.pushState(null, "", newRelativePathQuery);
    return !!urlParam;
  };

  // Proxy events that are unused by DM integration
  onEntityCreate = (...args) => this.datamanager.invoke("onEntityCreate", ...args);
  onEntityDelete = (...args) => this.datamanager.invoke("onEntityDelete", ...args);
  _selectAnnotationTimeout = null;
  onSelectAnnotation = (prevAnnotation, nextAnnotation, options) => {
    if (window.APP_SETTINGS.read_only_quick_view_enabled && !this.labelStream) {
      prevAnnotation?.setEditable(false);
    }

    // FIT-720: Debounce selectAnnotation callbacks during batch selection (init)
    // During init, selectAnnotation fires for ALL annotations in rapid succession
    // This debounce ensures only the final selection triggers the callback
    if (isFF(FF_FIT_720_LAZY_LOAD_ANNOTATIONS)) {
      if (this._selectAnnotationTimeout) {
        clearTimeout(this._selectAnnotationTimeout);
      }
      this._selectAnnotationTimeout = setTimeout(() => {
        this._selectAnnotationTimeout = null;
        this._invokeSelectAnnotation(prevAnnotation, nextAnnotation, options);
      }, 0);
      return;
    }

    this._invokeSelectAnnotation(prevAnnotation, nextAnnotation, options);
  };

  _invokeSelectAnnotation = async (prevAnnotation, nextAnnotation, options) => {
    // FIT-720: Hydrate stub annotations when selected
    // IMPORTANT: Use the CURRENTLY SELECTED annotation, not the one from the callback
    // The debounce may have caused the callback annotation to be stale
    if (isFF(FF_FIT_720_LAZY_LOAD_ANNOTATIONS)) {
      const currentSelected = this.lsf?.annotationStore?.selected;
      if (currentSelected?.pk) {
        await this._hydrateStubAnnotation(currentSelected);
      }
    }

    if (nextAnnotation?.history?.undoIdx) {
      this.saveDraft(nextAnnotation).then(() => {
        this.datamanager.invoke("onSelectAnnotation", prevAnnotation, nextAnnotation, options, this);
      });
    } else {
      this.datamanager.invoke("onSelectAnnotation", prevAnnotation, nextAnnotation, options, this);
    }
  };

  // FIT-720: Hydrate a stub annotation by fetching full data from API
  _hydrateStubAnnotation = async (annotation) => {
    // Check if annotation is a stub (no regions/results)
    // Stubs have empty results - check via the areas map which holds deserialized regions
    const hasRegions = annotation.areas?.size > 0;
    const isUserGenerated = annotation.userGenerate && !annotation.sentUserGenerate;

    // Also check versions.result to see if the annotation was loaded with actual results
    const versionsResult = annotation.versions?.result;
    const hasVersionsResult = Array.isArray(versionsResult) && versionsResult.length > 0;

    console.log("[FIT-720] _hydrateStubAnnotation called:", {
      pk: annotation.pk,
      hasRegions,
      isUserGenerated,
      areasSize: annotation.areas?.size,
      hasVersionsResult,
      versionsResultLength: versionsResult?.length,
    });

    // Skip if already hydrated or is a new user-generated annotation
    // Use versionsResult as the source of truth - if it has data, the annotation is already hydrated
    if (hasVersionsResult || isUserGenerated) {
      console.log("[FIT-720] Skipping hydration - already has versionsResult or is user-generated");
      return;
    }

    // If areas exist but no versionsResult, the areas might be stale/incorrect - proceed with hydration
    if (hasRegions && !hasVersionsResult) {
      console.log("[FIT-720] Areas exist but no versionsResult - will hydrate anyway");
    }

    const annotationId = annotation.pk;
    console.log(`[FIT-720] Fetching full annotation ${annotationId} from API...`);

    try {
      const fullAnnotation = await this.datamanager.apiCall("fetchAnnotation", {
        annotationID: annotationId,
      });

      console.log(`[FIT-720] API response for annotation ${annotationId}:`, {
        hasResult: !!fullAnnotation?.result,
        resultLength: fullAnnotation?.result?.length,
        error: fullAnnotation?.error,
        fullResponse: fullAnnotation,
      });

      // Check if this annotation is still the selected one
      const currentSelected = this.lsf?.annotationStore?.selected;
      console.log("[FIT-720] Current selected annotation:", currentSelected?.pk, "hydrating:", annotationId);

      if (fullAnnotation?.result && !fullAnnotation.error) {
        console.log(
          `[FIT-720] Hydrating annotation ${annotationId} with ${fullAnnotation.result?.length || 0} regions`,
        );

        // Freeze history to prevent undo/redo issues during hydration
        annotation.history?.freeze?.();

        // Deserialize the results into the annotation
        annotation.deserializeResults(fullAnnotation.result);

        console.log("[FIT-720] After deserializeResults, areas.size:", annotation.areas?.size);

        // Critical: updateObjects() MUST be called to render visual regions after deserializing
        annotation.updateObjects?.();

        console.log("[FIT-720] After updateObjects, areas.size:", annotation.areas?.size);

        // Unfreeze history
        annotation.history?.safeUnfreeze?.();

        // reinitHistory cancels autosave and sets initial values so LSF knows this is the base state
        // This prevents the hydration from being treated as a user modification
        annotation.reinitHistory?.();

        console.log(`[FIT-720] Hydration complete for annotation ${annotationId}`);

        // Force React/MobX to re-render by triggering updateObjects again after a microtask
        // This ensures the canvas picks up the new regions
        setTimeout(() => {
          console.log(`[FIT-720] Delayed updateObjects for annotation ${annotationId}`);
          annotation.updateObjects?.();
        }, 0);
      } else {
        console.log(`[FIT-720] No result data in API response for annotation ${annotationId}`);
      }
    } catch (error) {
      console.error(`[FIT-720] Failed to hydrate annotation ${annotationId}:`, error);
    }
  };

  onNextTask = async (nextTaskId, nextAnnotationId) => {
    this.saveDraft();
    this.loadTask(nextTaskId, nextAnnotationId, true);
  };
  onPrevTask = async (prevTaskId, prevAnnotationId) => {
    this.saveDraft();
    this.loadTask(prevTaskId, prevAnnotationId, true);
  };
  async submitCurrentAnnotation(eventName, submit, includeId = false, loadNext = true) {
    const { taskID, currentAnnotation } = this;
    const unique_id = this.task.unique_lock_id;
    const serializedAnnotation = this.prepareData(currentAnnotation, { includeId });

    if (unique_id) {
      serializedAnnotation.unique_id = unique_id;
    }

    this.setLoading(true);

    await this.saveUserLabels();

    const result = await this.withinLoadingState(async () => {
      const result = await submit(taskID, serializedAnnotation);

      return result;
    });

    if (result && result.id !== undefined) {
      const annotationId = result.id.toString();

      currentAnnotation.updatePersonalKey(annotationId);

      const eventData = annotationToServer(currentAnnotation);

      this.datamanager.invoke(eventName, this.lsf, eventData, result);

      // Persist any queued comments which are not currently attached to an annotation
      if (
        isFF(FF_DEV_2887) &&
        ["submitAnnotation", "skipTask"].includes(eventName) &&
        this.lsf?.commentStore?.persistQueuedComments
      ) {
        await this.lsf.commentStore.persistQueuedComments();
      }
    }

    this.setLoading(false);
    if (result?.$meta?.status >= 400) {
      // don't reload the task on error to avoid losing the user's changes
      return result;
    }

    if (!loadNext || this.datamanager.isExplorer) {
      await this.loadTask(taskID, currentAnnotation.pk, true);
    } else {
      await this.loadTask();
    }

    return result;
  }

  /**
   * Finds the active draft for the given annotation.
   * @param {Object} annotation - The annotation object.
   * @returns {Object|undefined} The active draft or undefined if no draft is found.
   * @private
   */
  findActiveDraft(annotation) {
    if (isDefined(annotation.draftId)) {
      return this.task.drafts.find((possibleDraft) => possibleDraft.id === annotation.draftId);
    }
    return undefined;
  }

  /**
   * Calculates the startedAt time for an annotation.
   * @param {Object|undefined} currentDraft - The current draft object, if any.
   * @param {Date} loadedDate - The date when the annotation was loaded.
   * @returns {Date} The calculated startedAt time.
   * @private
   */
  calculateStartedAt(currentDraft, loadedDate) {
    if (currentDraft) {
      const draftStartedAt = new Date(currentDraft.created_at);
      const draftLeadTime = Number(currentDraft.lead_time ?? 0);
      const adjustedStartedAt = new Date(Date.now() - draftLeadTime * 1000);

      if (adjustedStartedAt < draftStartedAt) return draftStartedAt;

      return adjustedStartedAt;
    }
    return loadedDate;
  }

  /**
   * Prepare data for draft/submission of annotation
   * @param {Object} annotation - The annotation object.
   * @param {Object} options - The options object.
   * @param {boolean} options.includeId - Whether to include the id in the result.
   * @param {boolean} options.isNewDraft - Whether the draft is new.
   * @returns {Object} The prepared data.
   * @private
   */
  prepareData(annotation, { includeId, isNewDraft } = {}) {
    const userGenerate = !annotation.userGenerate || annotation.sentUserGenerate;
    const currentDraft = this.findActiveDraft(annotation);
    const sessionTime = (Date.now() - annotation.loadedDate.getTime()) / 1000;
    const submittedTime = isNewDraft ? 0 : Number(annotation.leadTime ?? 0);
    const draftTime = Number(currentDraft?.lead_time ?? 0);
    const leadTime = submittedTime + draftTime + sessionTime;
    const startedAt = this.calculateStartedAt(currentDraft, annotation.loadedDate);

    const result = {
      lead_time: leadTime,
      result: (isNewDraft ? annotation.versions.draft : annotation.serializeAnnotation()) ?? [],
      draft_id: annotation.draftId,
      parent_prediction: annotation.parent_prediction,
      parent_annotation: annotation.parent_annotation,
      started_at: startedAt.toISOString(),
    };

    if (includeId && userGenerate) {
      result.id = Number.parseInt(annotation.pk);
    }

    return result;
  }

  /** @private */
  setLoading(isLoading, shouldReset = false) {
    if (isFF(FF_LSDV_4620_3_ML) && shouldReset) this.lsf.clearApp();
    this.lsf.setFlags({ isLoading });
    if (isFF(FF_LSDV_4620_3_ML) && shouldReset) this.lsf.renderApp();
  }

  async withinLoadingState(callback) {
    let result;

    this.setLoading(true);
    if (callback) {
      result = await callback.call(this);
    }
    this.setLoading(false);

    return result;
  }

  destroy() {
    this.lsfInstance?.destroy?.();
    this.lsfInstance = null;
  }

  get taskID() {
    return this.task.id;
  }

  get taskHistory() {
    return this.lsf.taskHistory;
  }

  get currentAnnotation() {
    try {
      return this.lsf.annotationStore.selected;
    } catch {
      return null;
    }
  }

  get annotations() {
    return this.lsf.annotationStore.annotations;
  }

  get predictions() {
    return this.lsf.annotationStore.predictions;
  }

  /** @returns {string|null} */
  get lsfConfig() {
    return this.datamanager.store.labelingConfig;
  }

  /** @returns {Dict} */
  get project() {
    return this.datamanager.store.project;
  }

  /** @returns {string|null} */
  get instruction() {
    return (this.project.instruction ?? this.project.expert_instruction ?? "").trim() || null;
  }

  get canPreloadTask() {
    return Boolean(this.preload?.interaction);
  }
}
