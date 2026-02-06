"""
Author: Marit van den Helder
"""

import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt
import simulate


def roi_analysis(filename):
    print("ROI")
    roi = pd.read_csv(filename)

    print("Mean:", roi["roi"].mean())
    print("SD:", roi["roi"].std())

    plt.hist(roi["roi"])
    plt.title("Distribution of ROI")
    plt.show()


def agent_analysis(filename):
    print("Agents")

    agents = pd.read_csv(filename)

    print("Mean:", agents["change"].mean())
    print("SD:", agents["change"].std())

    # plt.hist(agents[["seed", "change"]].groupby(["seed"]).mean())
    plt.hist(agents["change"])
    plt.title("Distribution of change in agent propensity")
    plt.show()


if __name__ == "__main__":
    roi_analysis("10000_agents_50_260_roi.csv")
    agent_analysis("10000_agents_50_260_agents.csv")
