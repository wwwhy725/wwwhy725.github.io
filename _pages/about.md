---
permalink: /
title: "About Me"
excerpt: "About me"
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

I am Hanyu Wang, a third-year PhD student at Penn State University, fortunate to be advised by [Prof. Jinghui Chen](https://jinghuichen.github.io/). Previously, I received my Bachelor of Science degree from the Department of Mathematics at University of Science and Technology of China (USTC) in June 2024.

My research lies at the intersection of Natural Language Processing and Trustworthy AI. I am broadly interested in a range of topics aimed at making AI systems more capable and reliable, including:

* Understanding and mitigating hallucinations in LLMs.
* Enhancing the multi-step reasoning abilities of language models.
* Building advanced agentic systems capable of reflection.

News
======

<div class="news-box"><div class="news-scroll" markdown="1">

* <span class="news-date">2026/10</span> Our new paper, "[Balancing Reference Guidance and Free Generation in Trajectory Rollouts for Reasoning RL](https://arxiv.org/pdf/2610.11128)", a result of my internship at **Honda Research Institute**, is now available on arXiv.
* <span class="news-date">2026/10</span> Our new benchmark, "[DecisionRobust: Benchmarking Robustness for JEV Style Decision Models Across Text and Vision](https://arxiv.org/pdf/2610.19118)", is now available on arXiv, with a [project page](https://yifan-lan.github.io/DecisionRobust/) and [code](https://github.com/Yifan-Lan/DecisionRobust).
* <span class="news-date">2026/09</span> Our paper, "[ProD: Progress-Aware Distillation for Mitigating Stagnation in Small Language Model Agents](https://arxiv.org/pdf/2610.19439)", was accepted to **NeurIPS 2026**! See you in Atlanta!
* <span class="news-date">2026/09</span> Our paper, "[Skill Transfer: Adapting Agent Skills from Strong to Weak Agents](https://openreview.net/pdf?id=ag6fz5QxZ7)", was accepted to the **[NeurIPS 2026 TTCL Workshop](https://ttcl-agents.github.io/)**.
* <span class="news-date">2026/05</span> Our new paper, "[SkillGrad: Optimizing Agent Skills Like Gradient Descent](https://arxiv.org/pdf/2605.27760)", is now available on arXiv, with code released on [GitHub](https://github.com/wwwhy725/SkillGrad).
* <span class="news-date">2026/05</span> Our paper on detecting evasive data contamination, "[The Illusion of Reasoning: Exposing Evasive Data Contamination in LLMs via Zero-CoT Truncation](https://arxiv.org/pdf/2605.21856)", is now available on arXiv, with [code](https://github.com/Yifan-Lan/zero-cot-probe).
* <span class="news-date">2026/05</span> Started my summer research internship at **Honda Research Institute**.
* <span class="news-date">2026/05</span> Honored to be recognized as a **Silver Reviewer** at ICML 2026.
* <span class="news-date">2026/02</span> Our paper, "[PreFlect: From Retrospective to Prospective Reflection in Large Language Model Agents](https://arxiv.org/pdf/2602.07187)", is now available on arXiv.
* <span class="news-date">2025/05</span> Our paper, "[TruthFlow: Truthful LLM Generation via Representation Flow Correction](https://arxiv.org/abs/2502.04556)", was accepted to **ICML 2025**!
* <span class="news-date">2024/07</span> Our paper, "[On the Discrepancy and Connection between Memorization and Generation in Diffusion Models](https://openreview.net/pdf?id=ZqG5lo18tq)", was accepted to the **ICML 2024 Workshop on Foundation Models in the Wild**.

</div></div>

Selected Publications & Preprints
======

{% assign selected = site.publications | where: "selected", true | sort: "date" | reverse %}
<div class="pub-list">
{% for pub in selected %}{% include pub-card.html pub=pub %}{% endfor %}
</div>

Academic Service
======

* **Conference Reviewer:** NeurIPS 2026, ICML 2026, ACL Rolling Review (January 2026, May 2025)
* **Journal Reviewer:** Transactions on Machine Learning Research (TMLR)

Contact
=======
Email: hbw5365 at psu dot edu
