import type { TipsCollection } from "./types";

export const defaultTipsCollection: TipsCollection = {
  projectCreation: [
    {
      title: "Did you know?",
      content: "You can use or modify dozens of templates to configure your labeling UI, from image classification to text annotation.",
      closable: true,
      link: {
        label: "Learn more",
        url: "#",
        params: {
          experiment: "project_creation_tip",
          treatment: "templates",
        },
      },
    },
    {
      title: "Labeling for GenAI",
      content: "MLTL Annotate has templates for supervised LLM fine-tuning, RAG retrieval ranking, RLHF, chatbot evaluation, and more.",
      closable: true,
      link: {
        label: "Explore templates",
        url: "#",
        params: {
          experiment: "project_creation_tip",
          treatment: "genai_templates",
        },
      },
    },
  ],
  organizationPage: [
    {
      title: "Collaborate with your team",
      content: "Invite team members, assign roles, and manage access to your labeling projects from the Organization page.",
      closable: true,
      link: {
        label: "Learn more",
        url: "#",
        params: {
          experiment: "organization_page_tip",
          treatment: "team_growing",
        },
      },
    },
    {
      title: "Did you know?",
      content: "MLTL Annotate supports integration with cloud storage, machine learning models, and popular tools to automate your ML pipeline.",
      closable: true,
      link: {
        label: "Learn more",
        url: "#",
        params: {
          experiment: "organization_page_tip",
          treatment: "integration_points",
        },
      },
    },
  ],
  projectSettings: [
    {
      title: "Save time with ML backends",
      content: "Connect ML models using the backend SDK to save time with pre-labeling or active learning.",
      closable: true,
      link: {
        label: "Learn more",
        url: "#",
        params: {
          experiment: "project_settings_tip",
          treatment: "connect_ml_models",
        },
      },
    },
    {
      title: "Review workflows",
      content: "Set up reviewer workflows to ensure high-quality labeled data with agreement scores and multi-annotator consensus.",
      closable: true,
      link: {
        label: "Learn more",
        url: "#",
        params: {
          experiment: "project_settings_tip",
          treatment: "quality_and_agreement",
        },
      },
    },
  ],
};