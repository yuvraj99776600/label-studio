---
title: "How to Evaluate Multi-Turn AI Conversations with Chainlit and Label Studio"
hide_sidebar: true
order: 1005
open_in_collab: true
tutorial: true
community_author: wesleylima
ipynb_repo_path: tutorials/how-to-multi-turn-chat-evals-with-chainlit-and-label-studio/how_to_multi_turn_chat_evals_with_chainlit_and_label_studio.ipynb
repo_url: https://github.com/HumanSignal/awesome-label-studio-tutorials/tree/main/tutorials/how-to-multi-turn-chat-evals-with-chainlit-and-label-studio
report_bug_url: https://github.com/HumanSignal/awesome-label-studio-tutorials/issues/new
thumbnail: 
---
This notebook demonstrates how to create a Label Studio project for evaluating chatbot conversations using the Chatbot Evaluation template.

The allows you to:
- Review multi-turn conversations
- Rate assistant responses for accuracy, clarity, and helpfulness
- Evaluate grounding in documentation
- Assess tone and style
- Track whether questions were answered

Reference: [Chatbot Evaluation Template](https://docs.humansignal.com/templates/chatbot)

## Label Studio Requirements

This tutorial showcases one or more features available only in Label Studio paid products. We recommend [creating a Starter Cloud trial](https://app.humansignal.com/user/cloud-trial?offer=d9a5&) to follow the tutorial.

## Setup and Installation

First, install the Label Studio SDK if you haven't already.

For more information about the SDK, see the [Label Studio Python SDK documentation](https://labelstud.io/guide/sdk).



```python
%pip install label-studio-sdk
```

    Collecting label-studio-sdk
      Downloading label_studio_sdk-2.0.11-py3-none-any.whl.metadata (7.0 kB)
    Requirement already satisfied: Pillow>=11.3.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (11.3.0)
    Collecting appdirs>=1.4.3 (from label-studio-sdk)
      Downloading appdirs-1.4.4-py2.py3-none-any.whl.metadata (9.0 kB)
    Collecting datamodel-code-generator==0.26.1 (from label-studio-sdk)
      Downloading datamodel_code_generator-0.26.1-py3-none-any.whl.metadata (24 kB)
    Requirement already satisfied: httpx>=0.21.2 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (0.28.1)
    Collecting ijson>=3.2.3 (from label-studio-sdk)
      Downloading ijson-3.4.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (21 kB)
    Collecting jsf<0.12.0,>=0.11.2 (from label-studio-sdk)
      Downloading jsf-0.11.2-py3-none-any.whl.metadata (5.0 kB)
    Requirement already satisfied: jsonschema>=4.23.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (4.25.1)
    Requirement already satisfied: lxml>=4.2.5 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (5.4.0)
    Requirement already satisfied: nltk<4.0.0,>=3.9.1 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (3.9.1)
    Requirement already satisfied: numpy<3.0.0,>=1.26.4 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.0.2)
    Requirement already satisfied: opencv-python<5.0.0,>=4.12.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (4.12.0.88)
    Requirement already satisfied: pandas>=0.24.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.2.2)
    Requirement already satisfied: pydantic>=1.9.2 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.11.9)
    Requirement already satisfied: pydantic-core<3.0.0,>=2.18.2 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.33.2)
    Requirement already satisfied: pyjwt<3.0.0,>=2.10.1 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.10.1)
    Requirement already satisfied: requests>=2.22.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.32.4)
    Collecting requests-mock==1.12.1 (from label-studio-sdk)
      Downloading requests_mock-1.12.1-py2.py3-none-any.whl.metadata (4.1 kB)
    Requirement already satisfied: typing_extensions>=4.0.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (4.15.0)
    Collecting ujson>=5.8.0 (from label-studio-sdk)
      Downloading ujson-5.11.0-cp312-cp312-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl.metadata (9.4 kB)
    Requirement already satisfied: urllib3>=2.5.0 in /usr/local/lib/python3.12/dist-packages (from label-studio-sdk) (2.5.0)
    Collecting xmljson==0.2.1 (from label-studio-sdk)
      Downloading xmljson-0.2.1-py2.py3-none-any.whl.metadata (12 kB)
    Collecting argcomplete<4.0,>=1.10 (from datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading argcomplete-3.6.2-py3-none-any.whl.metadata (16 kB)
    Collecting black>=19.10b0 (from datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading black-25.9.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.manylinux_2_28_x86_64.whl.metadata (83 kB)
    [2K     [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m83.5/83.5 kB[0m [31m3.3 MB/s[0m eta [36m0:00:00[0m
    [?25hCollecting genson<2.0,>=1.2.1 (from datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading genson-1.3.0-py3-none-any.whl.metadata (28 kB)
    Collecting inflect<6.0,>=4.1.0 (from datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading inflect-5.6.2-py3-none-any.whl.metadata (21 kB)
    Collecting isort<6.0,>=4.3.21 (from datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading isort-5.13.2-py3-none-any.whl.metadata (12 kB)
    Requirement already satisfied: jinja2<4.0,>=2.10.1 in /usr/local/lib/python3.12/dist-packages (from datamodel-code-generator==0.26.1->label-studio-sdk) (3.1.6)
    Requirement already satisfied: packaging in /usr/local/lib/python3.12/dist-packages (from datamodel-code-generator==0.26.1->label-studio-sdk) (25.0)
    Requirement already satisfied: pyyaml>=6.0.1 in /usr/local/lib/python3.12/dist-packages (from datamodel-code-generator==0.26.1->label-studio-sdk) (6.0.3)
    Requirement already satisfied: anyio in /usr/local/lib/python3.12/dist-packages (from httpx>=0.21.2->label-studio-sdk) (4.11.0)
    Requirement already satisfied: certifi in /usr/local/lib/python3.12/dist-packages (from httpx>=0.21.2->label-studio-sdk) (2025.8.3)
    Requirement already satisfied: httpcore==1.* in /usr/local/lib/python3.12/dist-packages (from httpx>=0.21.2->label-studio-sdk) (1.0.9)
    Requirement already satisfied: idna in /usr/local/lib/python3.12/dist-packages (from httpx>=0.21.2->label-studio-sdk) (3.10)
    Requirement already satisfied: h11>=0.16 in /usr/local/lib/python3.12/dist-packages (from httpcore==1.*->httpx>=0.21.2->label-studio-sdk) (0.16.0)
    Collecting faker>=15.3.4 (from jsf<0.12.0,>=0.11.2->label-studio-sdk)
      Downloading faker-37.8.0-py3-none-any.whl.metadata (15 kB)
    Collecting rstr>=3.2.0 (from jsf<0.12.0,>=0.11.2->label-studio-sdk)
      Downloading rstr-3.2.2-py3-none-any.whl.metadata (7.1 kB)
    Requirement already satisfied: smart-open>=6.3.0 in /usr/local/lib/python3.12/dist-packages (from smart-open[http]>=6.3.0->jsf<0.12.0,>=0.11.2->label-studio-sdk) (7.3.1)
    Requirement already satisfied: attrs>=22.2.0 in /usr/local/lib/python3.12/dist-packages (from jsonschema>=4.23.0->label-studio-sdk) (25.3.0)
    Requirement already satisfied: jsonschema-specifications>=2023.03.6 in /usr/local/lib/python3.12/dist-packages (from jsonschema>=4.23.0->label-studio-sdk) (2025.9.1)
    Requirement already satisfied: referencing>=0.28.4 in /usr/local/lib/python3.12/dist-packages (from jsonschema>=4.23.0->label-studio-sdk) (0.36.2)
    Requirement already satisfied: rpds-py>=0.7.1 in /usr/local/lib/python3.12/dist-packages (from jsonschema>=4.23.0->label-studio-sdk) (0.27.1)
    Requirement already satisfied: click in /usr/local/lib/python3.12/dist-packages (from nltk<4.0.0,>=3.9.1->label-studio-sdk) (8.3.0)
    Requirement already satisfied: joblib in /usr/local/lib/python3.12/dist-packages (from nltk<4.0.0,>=3.9.1->label-studio-sdk) (1.5.2)
    Requirement already satisfied: regex>=2021.8.3 in /usr/local/lib/python3.12/dist-packages (from nltk<4.0.0,>=3.9.1->label-studio-sdk) (2024.11.6)
    Requirement already satisfied: tqdm in /usr/local/lib/python3.12/dist-packages (from nltk<4.0.0,>=3.9.1->label-studio-sdk) (4.67.1)
    Requirement already satisfied: python-dateutil>=2.8.2 in /usr/local/lib/python3.12/dist-packages (from pandas>=0.24.0->label-studio-sdk) (2.9.0.post0)
    Requirement already satisfied: pytz>=2020.1 in /usr/local/lib/python3.12/dist-packages (from pandas>=0.24.0->label-studio-sdk) (2025.2)
    Requirement already satisfied: tzdata>=2022.7 in /usr/local/lib/python3.12/dist-packages (from pandas>=0.24.0->label-studio-sdk) (2025.2)
    Requirement already satisfied: annotated-types>=0.6.0 in /usr/local/lib/python3.12/dist-packages (from pydantic>=1.9.2->label-studio-sdk) (0.7.0)
    Requirement already satisfied: typing-inspection>=0.4.0 in /usr/local/lib/python3.12/dist-packages (from pydantic>=1.9.2->label-studio-sdk) (0.4.2)
    Requirement already satisfied: charset_normalizer<4,>=2 in /usr/local/lib/python3.12/dist-packages (from requests>=2.22.0->label-studio-sdk) (3.4.3)
    Collecting mypy-extensions>=0.4.3 (from black>=19.10b0->datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading mypy_extensions-1.1.0-py3-none-any.whl.metadata (1.1 kB)
    Collecting pathspec>=0.9.0 (from black>=19.10b0->datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading pathspec-0.12.1-py3-none-any.whl.metadata (21 kB)
    Requirement already satisfied: platformdirs>=2 in /usr/local/lib/python3.12/dist-packages (from black>=19.10b0->datamodel-code-generator==0.26.1->label-studio-sdk) (4.4.0)
    Collecting pytokens>=0.1.10 (from black>=19.10b0->datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading pytokens-0.1.10-py3-none-any.whl.metadata (2.0 kB)
    Requirement already satisfied: MarkupSafe>=2.0 in /usr/local/lib/python3.12/dist-packages (from jinja2<4.0,>=2.10.1->datamodel-code-generator==0.26.1->label-studio-sdk) (3.0.3)
    Collecting email-validator>=2.0.0 (from pydantic[email]!=2.0.0,!=2.0.1,!=2.4.0,<3.0,>=1.10.0; python_version >= "3.12" and python_version < "4.0"->datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading email_validator-2.3.0-py3-none-any.whl.metadata (26 kB)
    Requirement already satisfied: six>=1.5 in /usr/local/lib/python3.12/dist-packages (from python-dateutil>=2.8.2->pandas>=0.24.0->label-studio-sdk) (1.17.0)
    Requirement already satisfied: wrapt in /usr/local/lib/python3.12/dist-packages (from smart-open>=6.3.0->smart-open[http]>=6.3.0->jsf<0.12.0,>=0.11.2->label-studio-sdk) (1.17.3)
    Requirement already satisfied: sniffio>=1.1 in /usr/local/lib/python3.12/dist-packages (from anyio->httpx>=0.21.2->label-studio-sdk) (1.3.1)
    Collecting dnspython>=2.0.0 (from email-validator>=2.0.0->pydantic[email]!=2.0.0,!=2.0.1,!=2.4.0,<3.0,>=1.10.0; python_version >= "3.12" and python_version < "4.0"->datamodel-code-generator==0.26.1->label-studio-sdk)
      Downloading dnspython-2.8.0-py3-none-any.whl.metadata (5.7 kB)
    Downloading label_studio_sdk-2.0.11-py3-none-any.whl (600 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m600.3/600.3 kB[0m [31m14.0 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading datamodel_code_generator-0.26.1-py3-none-any.whl (111 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m111.0/111.0 kB[0m [31m4.0 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading requests_mock-1.12.1-py2.py3-none-any.whl (27 kB)
    Downloading xmljson-0.2.1-py2.py3-none-any.whl (10 kB)
    Downloading appdirs-1.4.4-py2.py3-none-any.whl (9.6 kB)
    Downloading ijson-3.4.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl (148 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m148.3/148.3 kB[0m [31m3.0 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading jsf-0.11.2-py3-none-any.whl (49 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m49.3/49.3 kB[0m [31m1.2 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading ujson-5.11.0-cp312-cp312-manylinux_2_24_x86_64.manylinux_2_28_x86_64.whl (57 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m57.4/57.4 kB[0m [31m3.1 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading argcomplete-3.6.2-py3-none-any.whl (43 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m43.7/43.7 kB[0m [31m2.6 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading black-25.9.0-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.manylinux_2_28_x86_64.whl (1.7 MB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m1.7/1.7 MB[0m [31m44.8 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading faker-37.8.0-py3-none-any.whl (2.0 MB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m2.0/2.0 MB[0m [31m52.7 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading genson-1.3.0-py3-none-any.whl (21 kB)
    Downloading inflect-5.6.2-py3-none-any.whl (33 kB)
    Downloading isort-5.13.2-py3-none-any.whl (92 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m92.3/92.3 kB[0m [31m4.5 MB/s[0m eta [36m0:00:00[0m
    [?25hDownloading rstr-3.2.2-py3-none-any.whl (10 kB)
    Downloading email_validator-2.3.0-py3-none-any.whl (35 kB)
    Downloading mypy_extensions-1.1.0-py3-none-any.whl (5.0 kB)
    Downloading pathspec-0.12.1-py3-none-any.whl (31 kB)
    Downloading pytokens-0.1.10-py3-none-any.whl (12 kB)
    Downloading dnspython-2.8.0-py3-none-any.whl (331 kB)
    [2K   [90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[0m [32m331.1/331.1 kB[0m [31m18.3 MB/s[0m eta [36m0:00:00[0m
    [?25hInstalling collected packages: xmljson, genson, appdirs, ujson, rstr, pytokens, pathspec, mypy-extensions, isort, inflect, ijson, faker, dnspython, argcomplete, requests-mock, email-validator, black, jsf, datamodel-code-generator, label-studio-sdk
      Attempting uninstall: inflect
        Found existing installation: inflect 7.5.0
        Uninstalling inflect-7.5.0:
          Successfully uninstalled inflect-7.5.0
    Successfully installed appdirs-1.4.4 argcomplete-3.6.2 black-25.9.0 datamodel-code-generator-0.26.1 dnspython-2.8.0 email-validator-2.3.0 faker-37.8.0 genson-1.3.0 ijson-3.4.0 inflect-5.6.2 isort-5.13.2 jsf-0.11.2 label-studio-sdk-2.0.11 mypy-extensions-1.1.0 pathspec-0.12.1 pytokens-0.1.10 requests-mock-1.12.1 rstr-3.2.2 ujson-5.11.0 xmljson-0.2.1


## Configure Credentials
To support loading credentials from Google Colab Secrets with fallback to .env and environment sourced variables the following cell can be used.


```python
%pip install python-dotenv

# Load configuration with Google Colab Secrets support + fallback
IS_GOOGLE_COLAB = False

# Load from .env file if available (for local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass  # will use system env vars

def get_credential(key, default=None):
    global IS_GOOGLE_COLAB
    """Get credential from Colab Secrets first, then environment variables"""
    try:
        # Try Google Colab Secrets first (most secure)
        from google.colab import userdata
        IS_GOOGLE_COLAB = True
        return userdata.get(key)
    except:
        from os import environ
        IS_GOOGLE_COLAB = False
        # Fallback to environment variables (for local Jupyter)
        return environ.get(key, default)
```

    Requirement already satisfied: python-dotenv in /usr/local/lib/python3.12/dist-packages (1.1.1)


Set your environment variables before running:

```bash
# URL of your Label Studio instance
export LABEL_STUDIO_URL="https://app.humansignal.com"

# Your API key (find it in Account & Settings > Personal Access Token)
export LABEL_STUDIO_API_KEY="your-api-key-here"
```

**How to get your API key:**
1. Open Label Studio in your browser
2. Click on your profile (top-right)
3. Go to "Account & Settings"
4. Click "Access Token" (or "Personal Access Token")
5. Copy the existing token or create a new one



```python
import os
from label_studio_sdk import LabelStudio

# Get credentials from environment variables
ls_api_key = os.environ.get('LABEL_STUDIO_API_KEY')
ls_url = os.environ.get('LABEL_STUDIO_URL', 'https://app.humansignal.com')

if not ls_api_key:
    raise ValueError('❌ Please set LABEL_STUDIO_API_KEY environment variable.')

# Connect to Label Studio
try:
    ls = LabelStudio(base_url=ls_url, api_key=ls_api_key)
    print(f'✅ Connected to Label Studio at {ls_url}')
except Exception as e:
    raise ConnectionError(f'❌ Failed to connect to Label Studio: {str(e)}')

```

## Define the Chatbot Evaluation Label Config

This is the label config from the [Evaluate Production Conversations for RLHF
](https://docs.humansignal.com/templates/chat_rlhf) example. It includes:
- A chat interface for viewing conversations
- Overall quality of message rating
- Additinal comments


```python
LABEL_CONFIG = """
<View>
  <Style>
    .chat {
      border: 1px solid #ccc;
      padding: 10px;
      border-radius: 5px;
    }
    .evaluation {
        border: 2px solid #cc854f;
        background-color: #ffe4d0;
        color: #664228;
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 20px;
    }
    <!-- Choice text -->
    .evaluation span {
        color: #664228;
    }
    <!-- Star rating -->
    .evaluation .ant-rate-star.ant-rate-star-full span {
      color: #f4aa2a;
     }

    <!-- Dark mode comment text and button color -->
    [data-color-scheme="dark"] .evaluation .lsf-row p,
    [data-color-scheme="dark"] .evaluation button span {
       color: #f9f8f6
    }

    .overall-chat {
       border-bottom: 1px solid #cc854f;
       margin-bottom: 15px;
    }
    .instructions {
       color: #664228;
       background-color: #ffe4d0;
       padding-top: 15px;
       padding-bottom: 15px;
    }
    <!-- Allow enlarging the instruction text -->
    .lsf-richtext__container.lsf-htx-richtext {
      font-size: 16px !important;
      line-height: 1.6;
    }

    <!-- Remove excess height from the chat to allow space for instruction text -->
    .htx-chat {
      --excess-height: 275px
    }
  </Style>
  <View style="display: flex; gap: 24px;">

    <!-- Left: conversation -->
    <View className="chat" style="flex: 2;">
      <View className="instructions">
        <Text name="instructions" value="Review the conversation in detail.
                                         As you read through it, click on individual messages to
                                         provide feedback about accuracy, clarity, and intent." />
      </View>

      <Chat name="chat" value="$chat"
            minMessages="2"
            editable="false" />
    </View>

    <!-- Right: conversation-level evaluation -->
    <View style="flex: 1;" className="evaluation">
      <View style="position:sticky;top:14px">

          <!-- Evaluate the whole conversation -->
      <View className="overall-chat" style="margin-top:auto">
        <Header size="4">Overall quality of this conversation</Header>
        <Rating name="rating" toName="chat" />
                <View style="padding-top:15px">
          <Text name="add_comment" value="Add a comment (optional)" />
          <TextArea name="conversation_comment" toName="chat" />
                </View>
      </View>
        <!-- Only visible when no message is selected -->
         <View visibleWhen="no-region-selected">
          <View style="padding-top:15px">
          </View>
        </View>

        <!-- Only visible when a user message is selected, and only applies to selected message -->
        <View visibleWhen="region-selected" whenRole="user">
          <Header value="Classify the user message"/>
          <Choices name="request_classification" toName="chat" perRegion="true" >
            <Choice value="Question" />
            <Choice value="Clarifying Question" />
            <Choice value="Command or Request" />
            <Choice value="Positive Feedback" />
            <Choice value="Negative Feedback" />
            <Choice value="Off-topic / Chit-chat" />
          </Choices>
       </View>

        <!-- Only visible when an assistant message is selected, and only applies to selected message -->
        <View visibleWhen="region-selected" whenRole="assistant">
          <Header value="Rate assistant's clarity"/>
          <Rating name="assistant_response_clarity" toName="chat" perRegion="true" />

          <Header value="Rate assistant's accuracy"/>
          <Rating name="assistant_response_accuracy" toName="chat" perRegion="true" />

          <Header value="Classify the message tone"/>
          <Choices name="q" toName="chat" perRegion="true" >
            <Choice value="Professional" />
            <Choice value="Casual" />
          </Choices>

          <Header value="Add a comment (optional)"/>
          <TextArea perRegion="true" name="message_comment" toName="chat" />
       </View>
     </View>
   </View>
 </View>
</View>
"""

print("Label config loaded successfully")
```

    Label config loaded successfully


With the label config set, we now use it to create the Chat Evaluation project


```python
## Create Project with Label Config

# Define project parameters
PROJECT_TITLE = "Chatbot Conversation Evaluation"
PROJECT_DESCRIPTION = "Evaluate multi-turn chatbot conversations for accuracy, clarity, and helpfulness"

# Create the project using Label Studio SDK
project = ls.projects.create(
    title=PROJECT_TITLE,
    description=PROJECT_DESCRIPTION,
    label_config=LABEL_CONFIG
)
```


```python
## Get Project ID and URL

# Store project ID and build direct URL
project_id = project.id
project_url = f"{ls_url}/projects/{project_id}"

# Save project ID to .env file
with open('.env', 'a') as f:
    f.write(f"LABEL_STUDIO_PROJECT_ID={project_id}\n")

print(f"📋 Project Details:")
print(f"   ID: {project_id}")
print(f"   Direct URL: {project_url}")
print(f"\n🔗 Click here to open the project:")
print(f"   {project_url}")
```

## Part 2: Set Up Chainlit Integration

Now we'll set up a Chainlit chatbot that automatically syncs conversations to Label Studio.

### What We'll Build
- A chatbot UI using Chainlit
- Automatic conversation logging to JSON
- Auto-sync to Label Studio when users disconnect
- Support for conversation resumption with versioning

### Step 1: Install Additional Dependencies

We need Chainlit for the chat UI and Ollama for a local LLM.



```python
%pip install chainlit ollama openai anthropic

```

### Step 2: Create Helper Files

We'll create three Python files:
1. `conversation_logger.py` - Saves conversations to JSON
2. `auto_sync.py` - Automatically syncs to Label Studio
3. `chatbot_ui_auto_sync.py` - Main chatbot application

**Note:** Run these cells to create the files in your working directory.



```python
%%writefile conversation_logger.py
"""Conversation logger for saving chats to JSON"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional


class ConversationLogger:
    """Logs conversations to JSON files"""

    def __init__(self, output_dir: Path = Path("data/conversations")):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save_conversation(
        self,
        messages: List[Dict[str, str]],
        session_id: str,
        model: str,
        metadata: Optional[Dict] = None
    ) -> Path:
        """Save conversation to JSON file"""

        # Check if metadata contains auto_save flag
        is_auto_save = metadata and metadata.get('auto_save', False)

        conversation_data = {
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "model": model,
            "messages": messages,
            "turn_count": len([m for m in messages if m["role"] == "user"]),
            "metadata": {k: v for k, v in (metadata or {}).items() if k != 'auto_save'}
        }

        # For auto-save: use session ID only (continuous updates)
        # For manual save: add timestamp (creates snapshot)
        if is_auto_save:
            filename = f"conversation_{session_id}.json"
        else:
            filename = f"conversation_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        filepath = self.output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(conversation_data, f, indent=2, ensure_ascii=False)

        return filepath

```




```python
%%writefile auto_sync.py
"""Automatic Label Studio sync helper"""
import os
import json
from pathlib import Path
from typing import Optional
from datetime import datetime
from label_studio_sdk.client import LabelStudio
from dotenv import load_dotenv
load_dotenv()


class LabelStudioSync:
    """Helper class to push conversations to Label Studio"""

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        project_id: Optional[int] = None
    ):
        self.url = url or os.getenv('LABEL_STUDIO_URL', 'https://app.humansignal.com')
        self.api_key = api_key or os.getenv('LABEL_STUDIO_API_KEY')
        self.project_id = project_id or int(os.getenv('LABEL_STUDIO_PROJECT_ID', None))


        if not self.project_id:
            print("⚠️  LABEL_STUDIO_PROJECT_ID not set - auto-sync disabled")
            self.client = None

        if not self.url:
            print("⚠️  LABEL_STUDIO_URL not set - auto-sync disabled")
            self.client = None

        if not self.api_key:
            print("⚠️  LABEL_STUDIO_API_KEY not set - auto-sync disabled")
            self.client = None
        else:
            self.client = LabelStudio(base_url=self.url, api_key=self.api_key)

    def is_enabled(self) -> bool:
        """Check if auto-sync is enabled"""
        return self.client is not None and self.project_id > 0

    async def push_conversation(self, conversation_file: Path) -> bool:
        """Push a single conversation to Label Studio"""
        if not self.is_enabled():
            return False

        try:
            # Load conversation
            with open(conversation_file, 'r') as f:
                data = json.load(f)

            # Format as Label Studio task
            task = {
                'data': {
                    'chat': data['messages'],  # Changed from 'messages' to 'chat' to match label config
                    'text': 'Review the conversation below and evaluate the quality of the chat interaction.',
                    'session_id': data.get('session_id', 'unknown'),
                    'thread_id': data.get('metadata', {}).get('thread_id', data.get('session_id')),
                    'model': data.get('model', 'unknown'),
                    'turn_count': data.get('turn_count', 0),
                    'timestamp': data.get('timestamp', ''),
                    'version': data.get('metadata', {}).get('version', 1),
                },
                'meta': {
                    'filename': conversation_file.name,
                    'imported_at': datetime.utcnow().isoformat() + 'Z',
                    'auto_synced': True
                }
            }

            # Check if already imported
            session_id = data.get('session_id')
            existing = self.client.tasks.list(project=self.project_id)

            for existing_task in existing:
                if hasattr(existing_task, 'data') and \
                   existing_task.data.get('session_id') == session_id:
                    print(f"⏭️  Session {session_id} already in Label Studio")
                    return False

            # Import task
            self.client.projects.import_tasks(id=self.project_id, request=[task])
            print(f"✅ Auto-synced {session_id} to Label Studio")
            return True

        except Exception as e:
            print(f"❌ Failed to sync {conversation_file.name}: {e}")
            return False


# Global instance
_sync = None

def get_sync() -> LabelStudioSync:
    """Get the global sync instance"""
    global _sync
    if _sync is None:
        _sync = LabelStudioSync()
    return _sync


async def auto_push_conversation(conversation_file: Path):
    """Push a conversation to Label Studio (async wrapper)"""
    sync = get_sync()
    if sync.is_enabled():
        await sync.push_conversation(conversation_file)

```


```python
%%writefile chatbot_ui_auto_sync.py
"""
Chainlit Chatbot with Automatic Label Studio Sync
Handles resumed conversations with versioned tasks
"""
import os
import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv
load_dotenv()

import chainlit as cl

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

from conversation_logger import ConversationLogger
from auto_sync import get_sync


# Configuration
MIN_TURNS_FOR_SYNC = 2  # Minimum conversation length to sync


def get_available_models() -> Dict[str, List[str]]:
    """Return available models by provider"""
    models = {}

    if OPENAI_AVAILABLE and os.getenv("OPENAI_API_KEY"):
        models["OpenAI"] = ["gpt-4", "gpt-3.5-turbo"]

    if ANTHROPIC_AVAILABLE and os.getenv("ANTHROPIC_API_KEY"):
        models["Anthropic"] = ["claude-3-sonnet-20240229"]

    if OLLAMA_AVAILABLE:
        try:
            ollama_models = ollama.list()
            if ollama_models and ollama_models.get('models'):
                models["Ollama"] = [m['name'] for m in ollama_models['models']]
            else:
                models["Ollama"] = ["llama3.2:3b"]
        except:
            models["Ollama"] = ["llama3.2:3b"]

    return models


async def generate_response(messages: List[Dict[str, str]], model: str) -> str:
    """Generate response from specified model"""
    provider, model_name = model.split("/", 1)

    if provider == "OpenAI":
        client = openai.OpenAI()
        response = client.chat.completions.create(
            model=model_name,
            messages=messages
        )
        return response.choices[0].message.content

    elif provider == "Anthropic":
        client = anthropic.Anthropic()
        response = client.messages.create(
            model=model_name,
            messages=messages,
            max_tokens=1024
        )
        return response.content[0].text

    elif provider == "Ollama":
        msg = cl.Message(content="")
        await msg.send()

        full_response = ""
        stream = ollama.chat(
            model=model_name,
            messages=messages,
            stream=True
        )

        for chunk in stream:
            content = chunk['message']['content']
            full_response += content
            await msg.stream_token(content)

        await msg.update()
        return full_response

    return "Error: Unknown provider"


def get_or_create_thread_id() -> str:
    """Get persistent thread ID for this conversation"""
    thread_id = cl.user_session.get("thread_id")

    if not thread_id:
        thread_id = str(uuid.uuid4())[:16]
        cl.user_session.set("thread_id", thread_id)

    return thread_id


@cl.on_chat_start
async def start():
    """Initialize chat session"""
    available_models = get_available_models()

    if not available_models:
        await cl.Message(
            content="⚠️ **No LLM providers configured!**\n\n"
            "Set up Ollama: `brew install ollama && ollama pull llama3.2:3b`"
        ).send()
        return

    model_list = []
    for provider, models in available_models.items():
        for model in models:
            model_list.append(f"{provider}/{model}")

    thread_id = get_or_create_thread_id()

    cl.user_session.set("messages", [])
    cl.user_session.set("logger", ConversationLogger())
    cl.user_session.set("model", model_list[0] if model_list else None)
    cl.user_session.set("available_models", model_list)
    cl.user_session.set("is_resumed", False)

    sync = get_sync()
    sync_status = f"✅ Auto-sync enabled (Project {sync.project_id})" if sync.is_enabled() else "💾 Auto-sync disabled"

    await cl.Message(
        content=f"💬 **Multi-Turn Chat Feedback**\n\n"
        f"**Thread:** `{thread_id}`\n"
        f"**Model:** `{model_list[0] if model_list else 'None'}`\n\n"
        f"{sync_status}\n\n"
        f"Ask me anything!"
    ).send()


@cl.on_chat_resume
async def on_resume(thread: Dict):
    """Handle conversation resumption"""
    available_models = get_available_models()
    model_list = []
    for provider, models in available_models.items():
        for model in models:
            model_list.append(f"{provider}/{model}")

    thread_id = thread.get("id")
    steps = thread.get("steps", [])

    messages = []
    for step in steps:
        if step.get("type") in ["user_message", "assistant_message"]:
            role = "user" if step["type"] == "user_message" else "assistant"
            messages.append({"role": role, "content": step.get("output", "")})

    cl.user_session.set("thread_id", thread_id)
    cl.user_session.set("messages", messages)
    cl.user_session.set("logger", ConversationLogger())
    cl.user_session.set("model", model_list[0] if model_list else None)
    cl.user_session.set("is_resumed", True)

    turn_count = len([m for m in messages if m["role"] == "user"])

    await cl.Message(
        content=f"🔄 **Resumed** | Thread: `{thread_id}` | Previous turns: {turn_count}"
    ).send()


@cl.on_message
async def main(message: cl.Message):
    """Handle incoming messages"""
    messages = cl.user_session.get("messages")
    model = cl.user_session.get("model")

    if not model:
        await cl.Message(content="⚠️ No model selected").send()
        return

    messages.append({"role": "user", "content": message.content})

    try:
        response = await generate_response(messages, model)
        messages.append({"role": "assistant", "content": response})
        cl.user_session.set("messages", messages)

        # Auto-save after each response
        logger = cl.user_session.get("logger")
        thread_id = get_or_create_thread_id()

        logger.save_conversation(
            messages=messages,
            session_id=thread_id,
            model=model,
            metadata={"auto_save": True, "last_updated": datetime.utcnow().isoformat()}
        )

    except Exception as e:
        await cl.Message(content=f"❌ Error: {str(e)}").send()


@cl.on_chat_end
async def on_chat_end():
    """Auto-push to Label Studio (with versioning for resumes)"""
    messages = cl.user_session.get("messages")
    thread_id = get_or_create_thread_id()
    model = cl.user_session.get("model")
    is_resumed = cl.user_session.get("is_resumed", False)

    if not messages:
        return

    turn_count = len([m for m in messages if m["role"] == "user"])

    if turn_count < MIN_TURNS_FOR_SYNC:
        print(f"⏭️  Only {turn_count} turns, skipping sync")
        return

    sync = get_sync()
    if not sync.is_enabled():
        print(f"ℹ️  Auto-sync disabled")
        return

    try:
        # Find existing versions
        existing_tasks = sync.client.tasks.list(project=sync.project_id)
        existing_versions = []

        for task in existing_tasks:
            if hasattr(task, 'data'):
                task_thread_id = task.data.get('thread_id') or task.data.get('session_id')
                if task_thread_id and task_thread_id.split('_v')[0] == thread_id.split('_v')[0]:
                    existing_versions.append(task)

        version = len(existing_versions) + 1
        versioned_session_id = f"{thread_id}_v{version}"

        # Save with version
        logger = cl.user_session.get("logger")
        filepath = logger.save_conversation(
            messages=messages,
            session_id=versioned_session_id,
            model=model,
            metadata={
                "auto_save": True,
                "version": version,
                "thread_id": thread_id,
                "was_resumed": is_resumed
            }
        )

        # Create task
        conversation_data = json.loads(filepath.read_text())
        task = {
            'data': {
                'chat': conversation_data['messages'],  # Changed from 'messages' to 'chat' to match label config
                'text': 'Review the conversation below and evaluate the quality of the chat interaction.',
                'session_id': versioned_session_id,
                'thread_id': thread_id,
                'model': model,
                'turn_count': turn_count,
                'version': version,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
            },
            'meta': {
                'auto_synced': True,
                'is_resume': is_resumed,
                'version': version,
            }
        }

        sync.client.projects.import_tasks(id=sync.project_id, request=[task])

        if version > 1:
            print(f"✅ Created version {version} (RESUME)")
        else:
            print(f"✅ Created version 1 (NEW)")

    except Exception as e:
        print(f"❌ Sync failed: {e}")


if __name__ == "__main__":
    pass

```

### Step 3: Set Up Ollama (Local LLM)

For this example, we'll use Ollama which runs a local LLM on your machine.

**Install Ollama:**
```bash
# macOS
brew install ollama

# Or download from https://ollama.ai
```

**Pull a model:**
```bash
ollama pull llama3.2:3b  # 3B model works on 16GB RAM
```

**Verify it's running:**
```bash
ollama list
```


### Step 4: Set Environment Variables

Set the project ID from earlier so the chatbot knows where to sync conversations.



```python
# Set environment variables for auto-sync
import os

# Set all required environment variables for auto-sync
os.environ['LABEL_STUDIO_URL'] = ls_url
os.environ['LABEL_STUDIO_API_KEY'] = ls_api_key
os.environ['LABEL_STUDIO_PROJECT_ID'] = str(project_id)

print(f"✅ Environment configured:")
print(f"   LABEL_STUDIO_URL: {ls_url}")
print(f"   LABEL_STUDIO_PROJECT_ID: {project_id}")
print(f"   LABEL_STUDIO_API_KEY: {'*' * 20}... (hidden)")
print(f"\n🔄 Auto-sync: ENABLED")
print(f"   Conversations will automatically sync to Label Studio when you close the chat!")

```

### Step 5: Run the Chainlit Chatbot

Now run the chatbot! It will automatically sync conversations to Label Studio.

**To run from terminal:**
```bash
chainlit run chatbot_ui_auto_sync.py --port 8087
```

Then:
1. Open http://localhost:8087 in your browser
2. Have a conversation (at least 2 turns)
3. Close the browser tab
4. Check Label Studio - your conversation will be there!

**Features:**
- ✅ Automatic conversation capture
- ✅ Auto-sync to Label Studio on disconnect
- ✅ Conversation resumption with versioning
- ✅ Local LLM (free and private!)

**What happens:**
- Each message auto-saves to `data/conversations/`
- When you close the chat, it pushes to Label Studio
- If you resume the chat later, it creates a new version (v2, v3, etc.)

**Ready to annotate!** Visit your Label Studio project to start evaluating the conversations.


### Verify Files Created

Let's check that all necessary files were created.



```python
from pathlib import Path

required_files = [
    'conversation_logger.py',
    'auto_sync.py',
    'chatbot_ui_auto_sync.py'
]

print("📁 Checking files...")
for file in required_files:
    if Path(file).exists():
        print(f"   ✅ {file}")
    else:
        print(f"   ❌ {file} - MISSING!")

print(f"\n📋 Project URL: {project_url}")
print(f"\n🚀 Ready to run:")
print(f"   chainlit run chatbot_ui_auto_sync.py --port 8087")

```

## Summary

You've successfully set up:

1. ✅ **Label Studio Project** - Created with chatbot evaluation template
2. ✅ **Conversation Logger** - Saves chats to JSON automatically
3. ✅ **Auto-Sync** - Pushes conversations to Label Studio
4. ✅ **Chainlit Chatbot** - Full UI with local LLM support

**Complete workflow:**
```
User chats → Auto-save to JSON → Close browser → Auto-push to Label Studio → Ready to annotate!
```

**Key Features:**
- 🔒 **Private** - Local LLM, no data sent to cloud
- 🔄 **Versioning** - Resume conversations safely
- ⚡ **Automatic** - Zero manual export needed

**Next Steps:**
1. Run the chatbot: `chainlit run chatbot_ui_auto_sync.py --port 8087`
2. Have some conversations
3. Annotate them in Label Studio
4. Export annotations for model training or system prompt adjustment
