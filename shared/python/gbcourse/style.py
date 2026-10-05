"""Единый визуальный стиль курса для matplotlib.

Цвета совпадают с веб-частью (``shared/web/css/course.css``) и проверены на
различимость при дальтонизме (протанопия/дейтеранопия): первые три цвета
категориальной палитры различимы попарно — поэтому для точечных графиков
используем не более трёх классов.

Роли цветов (одинаковы во всём курсе):
    data — наблюдения; truth — истинная функция; model — текущий ансамбль F_m;
    tree — новое дерево h_m; residual — остатки; train/valid/test — выборки;
    classes — классы 0, 1, 2.
"""

from __future__ import annotations

INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"
SURFACE = "#fcfcfb"
PAGE = "#f9f9f7"

BLUE = "#2a78d6"
ORANGE = "#eb6834"
AQUA = "#1baf7a"
YELLOW = "#eda100"
MAGENTA = "#e87ba4"
GREEN = "#008300"
VIOLET = "#4a3aa7"
RED = "#e34948"

#: Категориальная палитра — всегда в этом порядке, без повторов по кругу
SERIES = [BLUE, ORANGE, AQUA, YELLOW, MAGENTA, GREEN, VIOLET, RED]

#: Последовательная шкала (синий, от светлого к тёмному)
BLUE_RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
             "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"]

#: Нейтральная середина расходящихся шкал
DIVERGING_MID = "#f0efec"

ROLE = {
    "data": INK_2,
    "truth": MUTED,
    "model": BLUE,
    "model_prev": "#86b6ef",
    "tree": ORANGE,
    "residual": MUTED,
    "train": BLUE,
    "valid": ORANGE,
    "test": AQUA,
    "classes": [BLUE, ORANGE, AQUA],
}


def cmap_sequential():
    """Одноцветная последовательная шкала (величина)."""
    from matplotlib.colors import LinearSegmentedColormap

    return LinearSegmentedColormap.from_list("gbc_blue", BLUE_RAMP)


def cmap_diverging():
    """Расходящаяся шкала синий ↔ серый ↔ красный (знак: остатки, градиенты, SHAP)."""
    from matplotlib.colors import LinearSegmentedColormap

    return LinearSegmentedColormap.from_list("gbc_div", ["#184f95", BLUE, DIVERGING_MID, RED, "#a32d2c"])


def cmap_proba():
    """Шкала вероятности класса 1: класс 0 (синий) ↔ 0.5 (серый) ↔ класс 1 (оранжевый)."""
    from matplotlib.colors import LinearSegmentedColormap

    return LinearSegmentedColormap.from_list("gbc_proba", [BLUE, "#9ec5f4", DIVERGING_MID, "#f4b08f", ORANGE])


def use_course_style(dpi: int = 110) -> None:
    """Применить стиль курса ко всем следующим графикам matplotlib."""
    import matplotlib as mpl
    from cycler import cycler

    mpl.rcParams.update({
        "figure.facecolor": SURFACE,
        "figure.dpi": dpi,
        "figure.figsize": (7.5, 4.2),
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "axes.edgecolor": AXIS,
        "axes.linewidth": 0.8,
        "axes.grid": True,
        "axes.axisbelow": True,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.titlesize": 12,
        "axes.titleweight": "semibold",
        "axes.titlelocation": "left",
        "axes.labelsize": 10.5,
        "axes.labelcolor": INK_2,
        "axes.prop_cycle": cycler(color=SERIES),
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "grid.linestyle": "-",
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK_2,
        "ytick.labelcolor": INK_2,
        "xtick.labelsize": 9.5,
        "ytick.labelsize": 9.5,
        "text.color": INK,
        "lines.linewidth": 2.0,
        "lines.solid_capstyle": "round",
        "lines.markersize": 5,
        "legend.frameon": False,
        "legend.fontsize": 9.5,
        "font.size": 10.5,
    })
    try:  # зарегистрировать шкалы курса под именами gbc_*
        import matplotlib

        for cm in (cmap_sequential(), cmap_diverging(), cmap_proba()):
            if cm.name not in matplotlib.colormaps:
                matplotlib.colormaps.register(cm)
        mpl.rcParams["image.cmap"] = "gbc_blue"
    except Exception:  # pragma: no cover - старые версии matplotlib
        pass
