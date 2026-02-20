---
title: MLTL Annotate overview
short: About MLTL Annotate
type: guide
tier: all
order: 2
order_enterprise: 2
section: "Discover & Learn"
meta_title: Overview of MLTL Annotate
meta_description: Get started with MLTL Annotate by creating projects to label and annotate data for machine learning and data science models.
---

## What is MLTL Annotate?

MLTL Annotate is an open source data labeling tool that supports multiple projects, users, and data types in one platform. It allows you to do the following:

- Perform different types of labeling with many data formats.

- Integrate MLTL Annotate with machine learning models to supply predictions for labels (pre-labels), or perform continuous active learning. See [Set up machine learning with your labeling process](ml).

<div class="enterprise-only">

- Use [MLTL Annotate as a cloud offering](https://humansignal.com/platform/).

</div>

<div class="opensource-only">

MLTL Annotate is also available an [Enterprise cloud service](https://humansignal.com/platform/) with enhanced security (SSO, RBAC, SOC2), team management features, data discovery, analytics and reporting, and support SLAs. A [free trial is available](https://humansignal.com/free-trial) to get started quickly and explore the enterprise cloud product.

</div>

## Interface

<div class="opensource-only">

<br>
<center><i>Project List Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/os/projects-min.png">
<br><br>
<center><i>Data Manager Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/os/project--data-manager-min.png">
<br><br>
<center><i>Quick View Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/os/project--data-manager--quick-view-min.png">

</div>

<div class="enterprise-only">

<br>
<center><i>Project List Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/ent/workspace-min.png">
<br><br>
<center><i>Data Manager Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/ent/project--data-manager-min.png">
<br><br>
<center><i>Quick View Screenshot</i></center>
<img class="make-intense-zoom" src="/images/terms/ent/project--data-manager--quick-view-min.png">

</div>



## Labeling workflow

Start and finish a labeling project with MLTL Annotate by following these steps:

<div class="opensource-only">

1. [Install MLTL Annotate](install.html).
2. [Start MLTL Annotate](start.html).
3. [Create accounts for MLTL Annotate](signup.html). Create an account to manage and set up labeling projects.
4. [Set up the labeling project](setup_project.html). Define the type of labeling to perform on the dataset and configure project settings.
5. [Set up the labeling interface](setup.html). Add the labels that you want annotators to apply and customize the labeling interface.
6. [Import data as labeling tasks](tasks.html).
7. [Label and annotate the data](labeling.html).
8. [Export the labeled data or the annotations](export.html).

</div>

<div class="enterprise-only">

1. [Create accounts for MLTL Annotate](manage_users.html#Signup). Create an account to manage and set up labeling projects.
2. [Restrict access to the project](manage_users.html). Set up role-based access control. Only available in MLTL Annotate Edition.
3. [Set up the labeling project](setup_project.html). Define the type of labeling to perform on the dataset and configure project settings.
4. [Set up the labeling interface](setup.html). Add the labels that you want annotators to apply and customize the labeling interface.
5. [Import data as labeling tasks](tasks.html).
6. [Label and annotate the data](labeling.html).
7. [Review the annotated tasks](quality.html). Only available in MLTL Annotate Edition.
8. [Export the labeled data or the annotations](export.html).

</div>

## MLTL Annotate citations

If you would like to cite MLTL Annotate, you can add the following information to your references section:

```
@misc{MLTL Annotate,
  title={{MLTL Annotate}: Data labeling software},
  url={https://github.com/yuvraj99776600/label-studio},
  note={Open source software available from https://github.com/yuvraj99776600/label-studio},
  author={
    Maxim Tkachenko and
    Mikhail Malyuk and
    Andrey Holmanyuk and
    Nikolai Liubimov},
  year={2020-2025},
}
```

## Architecture

<div class="opensource-only">

!!! error Enterprise
    You can use any of the Label Studio components in your own tools, or customize them to suit your needs. Before customizing Label Studio extensively, you might want to review MLTL Annotate Edition to see if it already contains the relevant functionality you want to build. See [Label Studio Features](https://docs.mltl.us/guide/label_studio_compare.html) for more.

</div>

The component parts of MLTL Annotate are available as modular extensible packages that you can integrate into your existing machine learning processes and tools.


| Module   | Technology      | Description      |
| --------------- | ----------------------------- | ------------------------------------------------------------- |
| [MLTL Annotate main app](https://github.com/yuvraj99776600/label-studio/)     | Python and [Django](https://www.djangoproject.com/)    | The main app with most of the backend code for MLTL Annotate; used to perform data labeling.    |
| [MLTL Annotate frontend](frontend_reference)       | JavaScript web app using [React](https://reactjs.org/) and [MST](https://github.com/mobxjs/mobx-state-tree) | Located within the main app repo. `web/apps/labelstudio` acts as the central integration point for all frontend elements. `web/libs/editor` is the frontend library.              |
| Data Manager      | JavaScript web app using [React](https://reactjs.org/)     | Manage data and tasks for labeling. Located under `web/libs/datamanager` in the main app repo.                         |
| [Machine Learning Backends](https://github.com/yuvraj99776600/label-studio-ml-backend) | Python   | Predict data labels at various parts of the labeling process. |

<br>
<div style="margin:auto; text-align:center;"><img src="/images/ls-modules-scheme.png"/></div>




