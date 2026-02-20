---
title: MLTL Annotate Python SDK 
short: Python SDK 
type: guide
tier: all
order: 404
order_enterprise: 404
meta_title: MLTL Annotate Python SDK 
meta_description: Overview information for the MLTL Annotate Python SDK.
section: "Integrate & Extend"

---

The [**MLTL Annotate Python SDK**](https://api.labelstud.io/api-reference/introduction/getting-started) allows you to seamlessly integrate MLTL Annotate into your data science and machine learning pipelines.

The SDK provides a set of predefined classes and methods to interact with the MLTL Annotate API directly from your Python scripts, making it easier to manage projects, import tasks, and handle annotations. 


## Benefits to using the Python SDK

- **Streamlined API Interactions**: The SDK simplifies API interactions with user-friendly Python methods and classes.
- **Integration**: Easily integrate MLTL Annotate actions into your existing data science workflows.
- **Automation**: Automate repetitive tasks such as project creation, task imports, and data exports.
- **Enhanced Data Preparation**: Use filters and custom configurations to prepare and manage data efficiently, ensuring high-quality annotations.
- **Asynchronous Operations**: Perform asynchronous data operations for better performance and handling of large datasets.


## Start using the MLTL Annotate Python SDK

1. Install the SDK:
   `pip install label-studio-sdk`
2. In your Python script, do the following:
   - Import the SDK.
   - Define your API key/access token and MLTL Annotate URL. You can generate a key from your **Account & Settings** page. For more information, see [Access Tokens](access_tokens).
   - Connect to the API.

```python
# Define the URL where MLTL Annotate is accessible
LABEL_STUDIO_URL = 'YOUR_BASE_URL'

# API key can be either your personal access token or legacy access token
LABEL_STUDIO_API_KEY = 'YOUR_API_KEY'

# Import the SDK and the client module
from label_studio_sdk import LabelStudio
client = LabelStudio(base_url=LABEL_STUDIO_URL, api_key=LABEL_STUDIO_API_KEY)
```


## Resources and links
 
* [**API reference**](https://api.labelstud.io/api-reference/introduction/getting-started) - This is our reference for all available MLTL Annotate API requests and parameters. 
* [**Label Studio Python Library README**](https://github.com/yuvraj99776600/label-studio-sdk) - This includes getting started information and more code examples.  
* [**5 Tips and Tricks for MLTL Annotate’s API and SDK**](https://mltl.us/blog/5-tips-and-tricks-for-label-studio-s-api-and-sdk/) - This provides additional user guidance and more examples.

